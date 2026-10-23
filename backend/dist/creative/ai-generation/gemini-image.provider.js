"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var GeminiImageProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiImageProvider = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
let GeminiImageProvider = GeminiImageProvider_1 = class GeminiImageProvider {
    logger = new common_1.Logger(GeminiImageProvider_1.name);
    apiKey = process.env.GEMINI_API_KEY;
    modelName = 'gemini-3-pro-image';
    baseUrl = `https://generativelanguage.googleapis.com/v1beta/models`;
    async generateImage(request) {
        const requestId = (0, uuid_1.v4)();
        const identityStats = { requested: request.identityReferences.length, fetched: 0, suppliedToModel: 0 };
        const visualStats = { requested: request.visualReferences.length, fetched: 0, suppliedToModel: 0 };
        this.logger.log(`[Gemini:${requestId}] REFERENCE_DISCOVERY: Identity References: ${identityStats.requested}, Visual References: ${visualStats.requested}`);
        if (!this.apiKey) {
            this.logger.error(`[Gemini:${requestId}] AUTH_ERROR: GEMINI_API_KEY is missing`);
            return { imageUrl: '', status: 'AI_GENERATION_FAILED', sourceType: 'AI_GENERATED', errorMessage: 'AUTH_ERROR: GEMINI_API_KEY is missing' };
        }
        try {
            this.logger.log(`[Gemini:${requestId}] REFERENCE_FETCH & MODEL_INPUT_PREPARATION started`);
            const parts = [];
            let totalBytes = 0;
            for (const ref of request.identityReferences) {
                try {
                    const base64Data = await this.fetchAndEncodeImage(ref.url);
                    identityStats.fetched++;
                    parts.push({ inline_data: { mime_type: 'image/jpeg', data: base64Data } });
                    identityStats.suppliedToModel++;
                    totalBytes += base64Data.length;
                }
                catch (e) {
                    this.logger.warn(`[Gemini:${requestId}] REFERENCE_INPUT_ERROR for identity ref: ${ref.url}`);
                    return { imageUrl: '', status: 'AI_GENERATION_FAILED', sourceType: 'AI_GENERATED', errorMessage: `REFERENCE_INPUT_ERROR: Failed to process identity reference` };
                }
            }
            for (const ref of request.visualReferences) {
                try {
                    const base64Data = await this.fetchAndEncodeImage(ref.url);
                    visualStats.fetched++;
                    parts.push({ inline_data: { mime_type: 'image/jpeg', data: base64Data } });
                    visualStats.suppliedToModel++;
                    totalBytes += base64Data.length;
                }
                catch (e) {
                    this.logger.warn(`[Gemini:${requestId}] Failed to fetch visual reference: ${ref.url}`);
                }
            }
            this.logger.log(`[Gemini:${requestId}] IDENTITY_REFERENCES: fetched: ${identityStats.fetched}, valid: ${identityStats.fetched}, supplied_to_model: ${identityStats.suppliedToModel}`);
            this.logger.log(`[Gemini:${requestId}] VISUAL_REFERENCES: fetched: ${visualStats.fetched}, valid: ${visualStats.fetched}, supplied_to_model: ${visualStats.suppliedToModel}`);
            this.logger.log(`[Gemini:${requestId}] MODEL_INPUT_PREPARATION completed. Total base64 payload: ${totalBytes} bytes`);
            parts.push({
                text: `Create a cinematic movie still. Preserve the facial identity and likeness of the provided reference subjects. No movie titles, no text, no typography, no logos, no credits, no watermarks. ${request.prompt}`
            });
            const payload = { contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE"] } };
            const url = `${this.baseUrl}/${this.modelName}:generateContent?key=${this.apiKey}`;
            this.logger.log(`[Gemini:${requestId}] GEMINI_REQUEST started to ${this.modelName}`);
            const startTime = Date.now();
            const response = await axios_1.default.post(url, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 60000
            });
            const latency = Date.now() - startTime;
            this.logger.log(`[Gemini:${requestId}] GENERATION_ACCEPTED. Latency: ${latency}ms`);
            const candidates = response.data.candidates;
            if (!candidates || candidates.length === 0)
                throw new Error("No candidates returned from Gemini");
            const generatedPart = candidates[0].content?.parts?.find((p) => p.inlineData || p.inline_data);
            if (!generatedPart)
                throw new Error("No image data returned from Gemini");
            const base64Output = generatedPart.inlineData?.data || generatedPart.inline_data?.data;
            const publicDir = path.join(process.cwd(), 'public', 'generated');
            if (!fs.existsSync(publicDir))
                fs.mkdirSync(publicDir, { recursive: true });
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
        }
        catch (error) {
            let errorClass = 'PROVIDER_ERROR';
            if (error.response?.status === 429)
                errorClass = 'RATE_LIMIT';
            if (error.response?.status === 401 || error.response?.status === 403)
                errorClass = 'AUTH_ERROR';
            if (error.code === 'ECONNABORTED')
                errorClass = 'TIMEOUT';
            if (error.response?.status === 400)
                errorClass = 'INVALID_REQUEST';
            if (error.response?.status >= 500)
                errorClass = 'MODEL_UNAVAILABLE';
            this.logger.error(`[Gemini:${requestId}] AI_GENERATION_FAILED: ${errorClass} - ${error.message}`);
            return { imageUrl: '', status: 'AI_GENERATION_FAILED', sourceType: 'AI_GENERATED', errorMessage: `${errorClass}: ${error.message}` };
        }
    }
    async fetchAndEncodeImage(url) {
        const response = await axios_1.default.get(url, { responseType: 'arraybuffer', timeout: 10000 });
        return Buffer.from(response.data, 'binary').toString('base64');
    }
};
exports.GeminiImageProvider = GeminiImageProvider;
exports.GeminiImageProvider = GeminiImageProvider = GeminiImageProvider_1 = __decorate([
    (0, common_1.Injectable)()
], GeminiImageProvider);
//# sourceMappingURL=gemini-image.provider.js.map