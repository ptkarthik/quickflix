import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService {
  private genAI: GoogleGenerativeAI;
  
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'mock-key');
  }

  async generateStructuredContent(prompt: string) {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'mock-key') {
      console.warn("No GEMINI_API_KEY found. Returning mocked data.");
      return this.getMockResponse(prompt);
    }

    const model = this.genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro", 
      generationConfig: { responseMimeType: "application/json" } 
    });
    
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);
  }

  private getMockResponse(prompt: string) {
    if (prompt.includes('ReelScript') || prompt.includes('short-form video')) {
        return [
          { startTime: '0s', endTime: '3s', visual: { type: 'text', direction: 'Fast zoom' }, voiceover: 'Mock hook voiceover', textOverlay: 'Wait, what?', transition: 'Hard cut' },
          { startTime: '3s', endTime: '8s', visual: { type: 'asset', direction: 'Pan left' }, voiceover: 'Mock context about the movie', textOverlay: 'Context', transition: 'Fade' },
          { startTime: '8s', endTime: '25s', visual: { type: 'text', direction: 'Static' }, voiceover: 'Mock main opinion', textOverlay: 'My Opinion', transition: 'Hard cut' },
          { startTime: '25s', endTime: '60s', visual: { type: 'asset', direction: 'Slow zoom' }, voiceover: 'Mock conclusion and CTA', textOverlay: 'Watch it now', transition: 'Fade out' }
        ];
    }
    if (prompt.includes('Instagram')) {
        return { hook: 'Mock Instagram Hook', caption: 'Mock Instagram Caption', shortCaption: 'Mock Short Caption', hashtags: '#mock #movie', reelOverlayText: 'Mock Overlay', cta: 'Mock CTA' };
    }
    if (prompt.includes('YouTube')) {
        return { titles: ['Mock Title 1', 'Mock Title 2', 'Mock Title 3'], description: 'Mock description', tags: '#mock', shortDescription: 'Mock short desc', pinnedComment: 'Mock comment' };
    }
    return { oneLiner: 'Mock one-liner', twoLiner: 'Mock two-liner', shortReview: 'Mock short review', detailedReview: 'Mock detailed review', pros: ['Pro 1', 'Pro 2'], cons: ['Con 1', 'Con 2'], verdict: 'Mock verdict' };
  }
}
