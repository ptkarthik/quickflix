import { Injectable, Logger } from '@nestjs/common';
import { AiGenerationProvider, AiGenerationRequest, AiGenerationResult } from './ai-generation.provider';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GeminiImageProvider implements AiGenerationProvider {
  private readonly logger = new Logger(GeminiImageProvider.name);
  private readonly apiKey = process.env.GEMINI_API_KEY;
  // Using the pro model as requested by the user
  private readonly modelName = 'gemini-3-pro-image';
  private readonly baseUrl = `https://generativelanguage.googleapis.com/v1beta/models`;

  async generateImage(request: AiGenerationRequest): Promise<AiGenerationResult> {
    const requestId = uuidv4();
    
    // Provenance counters
    const identityStats = { requested: request.identityReferences.length, fetched: 0, suppliedToModel: 0 };
    const visualStats = { requested: request.visualReferences.length, fetched: 0, suppliedToModel: 0 };

    this.logger.log(`[Gemini:${requestId}] REFERENCE_DISCOVERY: Identity References: ${identityStats.requested}, Visual References: ${visualStats.requested}`);

    if (!this.apiKey) {
      this.logger.error(`[Gemini:${requestId}] AUTH_ERROR: GEMINI_API_KEY is missing`);
      return { imageUrl: '', status: 'AI_GENERATION_FAILED', sourceType: 'AI_GENERATED', errorMessage: 'AUTH_ERROR: GEMINI_API_KEY is missing' };
    }

    try {
      this.logger.log(`[Gemini:${requestId}] REFERENCE_FETCH & MODEL_INPUT_PREPARATION started`);
      const parts: any[] = [];
      let totalBytes = 0;
      
      // 1. Process identity references (actor faces)
      for (const ref of request.identityReferences) {
        try {
          const base64Data = await this.fetchAndEncodeImage(ref.url);
          identityStats.fetched++;
          parts.push({ inline_data: { mime_type: 'image/jpeg', data: base64Data } });
          identityStats.suppliedToModel++;
          totalBytes += base64Data.length;
        } catch (e) {
          this.logger.warn(`[Gemini:${requestId}] REFERENCE_INPUT_ERROR for identity ref: ${ref.url}`);
          return { imageUrl: '', status: 'AI_GENERATION_FAILED', sourceType: 'AI_GENERATED', errorMessage: `REFERENCE_INPUT_ERROR: Failed to process identity reference` };
        }
      }

      // 2. Process visual references (artwork context)
      for (const ref of request.visualReferences) {
         try {
           const base64Data = await this.fetchAndEncodeImage(ref.url);
           visualStats.fetched++;
           parts.push({ inline_data: { mime_type: 'image/jpeg', data: base64Data } });
           visualStats.suppliedToModel++;
           totalBytes += base64Data.length;
         } catch (e) {
           this.logger.warn(`[Gemini:${requestId}] Failed to fetch visual reference: ${ref.url}`);
         }
      }

      this.logger.log(`[Gemini:${requestId}] IDENTITY_REFERENCES: fetched: ${identityStats.fetched}, valid: ${identityStats.fetched}, supplied_to_model: ${identityStats.suppliedToModel}`);
      this.logger.log(`[Gemini:${requestId}] VISUAL_REFERENCES: fetched: ${visualStats.fetched}, valid: ${visualStats.fetched}, supplied_to_model: ${visualStats.suppliedToModel}`);
      this.logger.log(`[Gemini:${requestId}] MODEL_INPUT_PREPARATION completed. Total base64 payload: ${totalBytes} bytes`);

      // 3. Add the strict text prompt
      parts.push({
        text: `Create a cinematic movie still. Preserve the facial identity and likeness of the provided reference subjects. No movie titles, no text, no typography, no logos, no credits, no watermarks. ${request.prompt}`
      });

      const payload = { contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE"] } };
      const url = `${this.baseUrl}/${this.modelName}:generateContent?key=${this.apiKey}`;
      
      this.logger.log(`[Gemini:${requestId}] GEMINI_REQUEST started to ${this.modelName}`);
      const startTime = Date.now();
      
      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000
      });

      const latency = Date.now() - startTime;
      this.logger.log(`[Gemini:${requestId}] GENERATION_ACCEPTED. Latency: ${latency}ms`);

      const candidates = response.data.candidates;
      if (!candidates || candidates.length === 0) throw new Error("No candidates returned from Gemini");

      const generatedPart = candidates[0].content?.parts?.find((p: any) => p.inlineData || p.inline_data);
      if (!generatedPart) throw new Error("No image data returned from Gemini");

      const base64Output = generatedPart.inlineData?.data || generatedPart.inline_data?.data;
      
      const publicDir = path.join(process.cwd(), 'public', 'generated');
      if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
      const filename = `gemini_${requestId}.jpg`;
      const filePath = path.join(publicDir, filename);
      fs.writeFileSync(filePath, Buffer.from(base64Output, 'base64'));

      this.logger.log(`[Gemini:${requestId}] GENERATED_ASSET_SAVED successfully at ${filename}`);

      return {
        imageUrl: `/generated/${filename}`,
        status: 'AI_GENERATED',
        sourceType: 'AI_GENERATED',
        provenance: {
          provider: 'gemini',
          model: this.modelName,
          promptVersion: 'v1_strict_textless',
          referenceImages: { identity: identityStats, visual: visualStats },
          generationRequestId: requestId,
          generatedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      let errorClass = 'PROVIDER_ERROR';
      if (error.response?.status === 429) errorClass = 'RATE_LIMIT';
      if (error.response?.status === 401 || error.response?.status === 403) errorClass = 'AUTH_ERROR';
      if (error.code === 'ECONNABORTED') errorClass = 'TIMEOUT';
      if (error.response?.status === 400) errorClass = 'INVALID_REQUEST';
      if (error.response?.status >= 500) errorClass = 'MODEL_UNAVAILABLE';

      this.logger.error(`[Gemini:${requestId}] AI_GENERATION_FAILED: ${errorClass} - ${error.message}`);
      return { imageUrl: '', status: 'AI_GENERATION_FAILED', sourceType: 'AI_GENERATED', errorMessage: `${errorClass}: ${error.message}` };
    }
  }

  private async fetchAndEncodeImage(url: string): Promise<string> {
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
    return Buffer.from(response.data, 'binary').toString('base64');
  }
}
