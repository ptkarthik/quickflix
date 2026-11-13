import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ReleaseDiscoveryService, CanonicalMovie } from './release-discovery.service';
import * as fs from 'fs';
import * as path from 'path';

export interface DiscoverySnapshot {
  upcomingTheater: CanonicalMovie[];
  nowInTheater: CanonicalMovie[];
  upcomingOTT: CanonicalMovie[];
  nowStreaming: CanonicalMovie[];
  pendingValidation: CanonicalMovie[];
  unclassified: CanonicalMovie[];
  audit: any;
}

export interface DiscoveryInitializingResponse {
  status: 'INITIALIZING';
  message: string;
  snapshotAvailable: false;
  refreshStatus: 'REFRESHING' | 'IDLE';
}

export interface DiscoveryCacheStatus {
  status: 'READY' | 'REFRESHING' | 'STALE' | 'INITIALIZING' | 'ERROR';
  snapshotAvailable: boolean;
  isRefreshing: boolean;
  snapshotAgeSeconds: number | null;
  lastSuccessfulRefresh: string | null;
  lastError: string | null;
  totalMovies: number;
  refreshIntervalMinutes: number;
}

@Injectable()
export class DiscoveryCacheService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(DiscoveryCacheService.name);

  private currentSnapshot: DiscoverySnapshot | null = null;
  private lastSuccessfulRefresh: Date | null = null;
  private lastError: string | null = null;
  private isRefreshing = false;
  private refreshTimer: NodeJS.Timeout | null = null;

  // Configurable refresh interval (default: 60 minutes)
  private readonly refreshIntervalMs: number;
  private readonly cacheDir: string;
  private readonly snapshotFileName = 'discovery-snapshot.json';

  constructor(private readonly releaseDiscovery: ReleaseDiscoveryService) {
    const configuredMinutes = process.env.DISCOVERY_CACHE_INTERVAL_MINUTES 
      ? parseInt(process.env.DISCOVERY_CACHE_INTERVAL_MINUTES, 10) 
      : 60;
    this.refreshIntervalMs = (isNaN(configuredMinutes) || configuredMinutes <= 0 ? 60 : configuredMinutes) * 60 * 1000;
    
    this.cacheDir = process.env.DISCOVERY_CACHE_DIR || path.join(process.cwd(), '.cache');
    this.ensureCacheDirExists();
    // Registry listener is bound in onApplicationBootstrap(): ReleaseDiscoveryService sits in a
    // forwardRef cycle and may still be an unconstructed placeholder at this point.
  }

  private isRegistryListenerBound = false;
  private bindRegistryListener(): void {
    if (this.isRegistryListenerBound) return;
    if (typeof this.releaseDiscovery?.onRegistryMutation === 'function') {
      this.isRegistryListenerBound = true;
      this.releaseDiscovery.onRegistryMutation((event: any) => {
        const reason = event?.reason || event?.type || 'unspecified';
        this.logger.warn(`[DiscoveryCache] Registry mutation detected (${reason}). Invalidating published snapshots.`);
        this.invalidateCache(`Registry mutation (${reason})`);
      });
    }
  }

  private ensureCacheDirExists(): void {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch (err: any) {
      this.logger.warn(`[DiscoveryCache] Failed to create cache directory ${this.cacheDir}: ${err.message}`);
    }
  }

  /**
   * Lifecycle hook: Startup
   * 1. Loads persisted snapshot from disk if valid
   * 2. Schedules recurring background refreshes
   * 3. Triggers initial background refresh asynchronously without blocking bootstrap
   */
  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('[DiscoveryCache] Bootstrapping background discovery cache coordinator...');
    
    // 1. Attempt to load persisted snapshot from disk
    this.loadPersistedSnapshotFromDisk();

    // 2. Register registry mutation listener to invalidate cache immediately
    this.bindRegistryListener();

    // 3. Start recurring schedule
    this.startBackgroundSchedule(this.refreshIntervalMs);

    // 4. Launch initial background crawl asynchronously without blocking HTTP server availability
    setImmediate(() => {
      this.triggerRefresh().catch(err => {
        this.logger.warn(`[DiscoveryCache] Initial background crawl notice: ${err.message}`);
      });
    });
  }

  /**
   * Lifecycle hook: Shutdown
   * Cleans up background interval timers
   */
  onApplicationShutdown(signal?: string): void {
    this.logger.log(`[DiscoveryCache] Application shutdown (${signal || 'SIGTERM'}). Disposing timers.`);
    this.stopBackgroundSchedule();
  }

  public startBackgroundSchedule(intervalMs: number): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    this.refreshTimer = setInterval(() => {
      this.triggerRefresh().catch(err => {
        this.logger.error(`[DiscoveryCache] Scheduled refresh execution error: ${err.message}`);
      });
    }, intervalMs);

    if (this.refreshTimer.unref) {
      this.refreshTimer.unref();
    }
  }

  public stopBackgroundSchedule(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Returns the cached snapshot if ready, or the structured INITIALIZING response if not yet compiled.
   * Never blocks on API calls and never returns a fake empty catalog.
   */
  public getSnapshotResponse(): DiscoverySnapshot | DiscoveryInitializingResponse {
    if (!this.currentSnapshot) {
      return {
        status: 'INITIALIZING',
        message: 'Discovery catalog is compiling its initial snapshot in the background. Please retry shortly.',
        snapshotAvailable: false,
        refreshStatus: this.isRefreshing ? 'REFRESHING' : 'IDLE'
      };
    }

    const ageSeconds = this.lastSuccessfulRefresh 
      ? Math.max(0, Math.floor((Date.now() - this.lastSuccessfulRefresh.getTime()) / 1000))
      : 0;

    // Return the snapshot enriched with transparent cache telemetry in the audit object
    return {
      ...this.currentSnapshot,
      audit: {
        ...(this.currentSnapshot.audit || {}),
        cache: {
          servedFromCache: true,
          snapshotAgeSeconds: ageSeconds,
          lastSuccessfulRefresh: this.lastSuccessfulRefresh?.toISOString() || null,
          refreshStatus: this.isRefreshing ? 'REFRESHING' : 'IDLE',
          cacheStatus: this.getStatus().status
        }
      }
    };
  }

  /**
   * Diagnostic status representation for GET /discover/cache-status
   */
  public getStatus(): DiscoveryCacheStatus {
    const ageSeconds = this.lastSuccessfulRefresh 
      ? Math.max(0, Math.floor((Date.now() - this.lastSuccessfulRefresh.getTime()) / 1000))
      : null;

    let status: 'READY' | 'REFRESHING' | 'STALE' | 'INITIALIZING' | 'ERROR';
    if (this.isRefreshing) {
      status = 'REFRESHING';
    } else if (this.currentSnapshot) {
      status = this.lastError ? 'STALE' : 'READY';
    } else if (this.lastError) {
      status = 'ERROR';
    } else {
      status = 'INITIALIZING';
    }

    return {
      status,
      snapshotAvailable: this.currentSnapshot !== null,
      isRefreshing: this.isRefreshing,
      snapshotAgeSeconds: ageSeconds,
      lastSuccessfulRefresh: this.lastSuccessfulRefresh ? this.lastSuccessfulRefresh.toISOString() : null,
      lastError: this.lastError,
      totalMovies: this.currentSnapshot ? this.countMovies(this.currentSnapshot) : 0,
      refreshIntervalMinutes: Math.round(this.refreshIntervalMs / 60000)
    };
  }

  /**
   * Invalidates in-memory snapshot and deletes on-disk snapshot file.
   * Triggered on registry mutations (e.g. retractions, invalidations).
   */
  public invalidateCache(reason?: string): void {
    this.logger.warn(`[DiscoveryCache] Invalidation requested. Reason: ${reason || 'unspecified'}`);
    this.currentSnapshot = null;
    this.lastSuccessfulRefresh = null;
    const targetPath = path.join(this.cacheDir, this.snapshotFileName);
    try {
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
        this.logger.log(`[DiscoveryCache] Removed on-disk snapshot at ${targetPath}`);
      }
    } catch (err: any) {
      this.logger.error(`[DiscoveryCache] Error removing on-disk snapshot: ${err.message}`);
    }
  }

  /**
   * Execute background refresh.
   * Guarded by mutex lock to prevent concurrent or overlapping executions.
   */
  public async triggerRefresh(): Promise<boolean> {
    if (this.isRefreshing) {
      this.logger.warn('[DiscoveryCache] Background refresh is already in progress. Skipping overlapping run.');
      return false;
    }

    this.isRefreshing = true;
    const startTime = Date.now();
    this.logger.log('[DiscoveryCache] Background discovery crawl started.');
    const startGeneration = typeof this.releaseDiscovery.getRegistryGeneration === 'function'
      ? this.releaseDiscovery.getRegistryGeneration()
      : 0;

    try {
      // Execute the frozen discovery and classification pipeline
      const candidate = await this.releaseDiscovery.discoverAll();

      // Guard against in-flight registry mutations during the discovery crawl
      const endGeneration = typeof this.releaseDiscovery.getRegistryGeneration === 'function'
        ? this.releaseDiscovery.getRegistryGeneration()
        : 0;
      if (endGeneration !== startGeneration) {
        this.logger.warn(
          `[DiscoveryCache] In-flight registry mutation detected during background refresh (gen ${startGeneration} -> ${endGeneration}). Discarding stale candidate snapshot to prevent republishing revoked evidence.`
        );
        return false;
      }

      // Guardrail 4: Validate candidate snapshot before publication
      if (!this.validateCandidateSnapshot(candidate)) {
        throw new Error('Candidate snapshot failed structural or mutual exclusivity validation');
      }

      // Persist snapshot atomically to disk (if disk write fails, in-memory state is still safely preserved)
      this.persistSnapshotToDisk(candidate);

      // Atomic in-memory swap
      this.currentSnapshot = candidate;
      this.lastSuccessfulRefresh = new Date();
      this.lastError = null;

      const durationMs = Date.now() - startTime;
      this.logger.log(`[DiscoveryCache] Background refresh completed successfully in ${durationMs}ms (${this.countMovies(candidate)} movies).`);
      return true;
    } catch (err: any) {
      this.lastError = err.message || 'Unknown discovery error';
      this.logger.error(`[DiscoveryCache] Background refresh failed: ${this.lastError}. Preserving last known-good snapshot.`);
      // If we have an existing snapshot, it remains active and untouched
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Structural and invariant validation for candidate snapshots before publication
   */
  public validateCandidateSnapshot(candidate: any): boolean {
    if (!candidate || typeof candidate !== 'object') {
      this.logger.error('[DiscoveryCache] Validation failed: candidate snapshot is null or non-object');
      return false;
    }

    const requiredBuckets = [
      'upcomingTheater',
      'nowInTheater',
      'upcomingOTT',
      'nowStreaming',
      'pendingValidation',
      'unclassified'
    ];

    for (const bucket of requiredBuckets) {
      if (!Array.isArray(candidate[bucket])) {
        this.logger.error(`[DiscoveryCache] Validation failed: bucket '${bucket}' is missing or not an array`);
        return false;
      }
    }

    const totalMovies = this.countMovies(candidate);
    if (totalMovies === 0) {
      this.logger.warn('[DiscoveryCache] Validation failed: candidate contains 0 total movies across all buckets');
      return false;
    }

    // Verify mutual exclusivity invariant if audit is present
    if (candidate.audit?.classificationEngine) {
      const ce = candidate.audit.classificationEngine;
      if (ce.leakageDetections > 0 || ce.mutualExclusivityGuaranteed === false) {
        this.logger.error(`[DiscoveryCache] Validation failed: mutual exclusivity invariant violated (${ce.leakageDetections} leakages detected)`);
        return false;
      }
    }

    return true;
  }

  /**
   * Atomic persistence to disk using temporary file and atomic rename
   */
  public persistSnapshotToDisk(snapshot: DiscoverySnapshot): boolean {
    try {
      this.ensureCacheDirExists();
      const targetPath = path.join(this.cacheDir, this.snapshotFileName);
      const tempPath = path.join(
        this.cacheDir, 
        `discovery-snapshot.${Date.now()}.${Math.random().toString(36).substring(2, 8)}.tmp`
      );

      const serialized = JSON.stringify(snapshot, null, 2);
      fs.writeFileSync(tempPath, serialized, 'utf-8');
      fs.renameSync(tempPath, targetPath);
      return true;
    } catch (err: any) {
      // Persistence error does NOT corrupt the in-memory snapshot
      this.logger.warn(`[DiscoveryCache] Failed to persist snapshot atomically to disk: ${err.message}. In-memory snapshot remains active.`);
      return false;
    }
  }

  /**
   * Load persisted snapshot from disk safely on bootstrap
   */
  public loadPersistedSnapshotFromDisk(): boolean {
    const targetPath = path.join(this.cacheDir, this.snapshotFileName);
    if (!fs.existsSync(targetPath)) {
      this.logger.log('[DiscoveryCache] No persisted snapshot found on disk. Initializing without pre-warmed snapshot.');
      return false;
    }

    try {
      const raw = fs.readFileSync(targetPath, 'utf-8');
      const data = JSON.parse(raw);

      if (this.validateCandidateSnapshot(data)) {
        this.currentSnapshot = data;
        const recordedDate = data.audit?.classificationEngine?.today;
        this.lastSuccessfulRefresh = recordedDate ? new Date(recordedDate) : new Date();
        this.lastError = null;
        this.logger.log(`[DiscoveryCache] Successfully restored valid persisted snapshot from disk (${this.countMovies(data)} movies). Ready immediately.`);
        return true;
      } else {
        this.logger.warn('[DiscoveryCache] Persisted snapshot on disk failed structural validation. Discarding.');
        return false;
      }
    } catch (err: any) {
      this.logger.warn(`[DiscoveryCache] Persisted snapshot on disk is corrupt or unreadable (${err.message}). Safely ignoring.`);
      return false;
    }
  }

  public countMovies(snapshot: DiscoverySnapshot): number {
    return (
      (snapshot.upcomingTheater?.length || 0) +
      (snapshot.nowInTheater?.length || 0) +
      (snapshot.upcomingOTT?.length || 0) +
      (snapshot.nowStreaming?.length || 0) +
      (snapshot.pendingValidation?.length || 0) +
      (snapshot.unclassified?.length || 0)
    );
  }

  // Testing helpers
  public setSnapshotForTesting(snapshot: DiscoverySnapshot | null, lastRefresh: Date | null = new Date(), error: string | null = null): void {
    this.currentSnapshot = snapshot;
    this.lastSuccessfulRefresh = lastRefresh;
    this.lastError = error;
  }

  public getSnapshotDirect(): DiscoverySnapshot | null {
    return this.currentSnapshot;
  }
}
