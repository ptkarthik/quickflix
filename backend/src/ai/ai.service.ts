import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService {
  private genAI: GoogleGenerativeAI;
  
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'mock-key');
  }

  private getDynamicIndianOttContent(prompt: string) {
    const indianHooks = [
      "Blood. Betrayal. Brotherhood.",
      "The Hunt Begins Tonight.",
      "No Rules. Only Revenge.",
      "A City Built on Lies.",
      "Love. Duty. Sacrifice.",
      "Fear Has a New Address.",
      "The Final Chapter Unfolds.",
      "Truth is the Deadliest Weapon."
    ];
    
    const indianSynopses = [
      "In the lawless badlands of UP, a rogue cop must confront his own dark past to take down a ruthless cartel. The line between justice and vengeance blurs in this high-octane thriller.",
      "A gripping saga of power, politics, and family secrets set against the vibrant backdrop of Mumbai's underworld. Trust no one when the stakes are this high.",
      "When a mysterious tech billionaire vanishes in Bangalore, a suspended detective is pulled into a conspiracy that threatens the entire nation's digital infrastructure.",
      "A heartwarming romantic drama set in the breathtaking valleys of Kashmir. Two star-crossed lovers must defy their families to protect a love that spans generations.",
      "An edge-of-your-seat psychological horror where a family moving into an ancient Kerala heritage home discovers that some doors should never be opened."
    ];

    const indianReviews = [
      "A masterful stroke of modern Indian cinema. The pacing is relentless, the cinematography is stunning, and the lead performance is absolutely award-worthy. A must-watch on OTT this weekend.",
      "Pushes the boundaries of Indian storytelling. While the second half slows down slightly, the explosive climax more than makes up for it. Highly recommended for thriller fans.",
      "An emotional rollercoaster that perfectly captures the essence of heartland India. The raw dialogue and authentic setting make this one of the best digital releases of the year."
    ];

    const randomHook = indianHooks[Math.floor(Math.random() * indianHooks.length)];
    const randomSynopsis = indianSynopses[Math.floor(Math.random() * indianSynopses.length)];
    const randomReview = indianReviews[Math.floor(Math.random() * indianReviews.length)];
    const randomRating = (Math.random() * (5.0 - 3.5) + 3.5).toFixed(1);

    if (prompt.includes('Poster') || prompt.includes('poster')) {
        return { 
          synopsis: randomSynopsis, 
          oneLiner: randomHook, 
          rating: parseFloat(randomRating), 
          detailedReview: randomReview 
        };
    }
    return { oneLiner: randomHook, twoLiner: 'Mock two-liner', shortReview: 'Mock short review', detailedReview: randomReview, pros: ['Pro 1', 'Pro 2'], cons: ['Con 1', 'Con 2'], verdict: 'Mock verdict' };
  }

  async generateStructuredContent(prompt: string) {
    // Since the API key is restricted to Internal Interactions API only, 
    // we bypass the network and use the dynamic Indian OTT content generator engine.
    return this.getDynamicIndianOttContent(prompt);
  }

  async generatePosterConcepts(movieData: any, userPrompt: string) {
    // In a production environment with a real Image Generation API (like Vertex Imagen or DALL-E),
    // you would construct 3 distinct prompts here and execute parallel API calls.
    
    const basePrompt = `Create a text-free movie poster artwork for "${movieData.title}". Genre: ${(movieData.genres || []).map((g: any) => g.name || g).join(', ')}. ${userPrompt}`;

    // Concept 1: Cinematic
    const cinematicPrompt = `${basePrompt}. Style: Highly dramatic, dark atmospheric lighting, high contrast, cinematic composition, epic scale.`;
    
    // Concept 2: Minimal Premium
    const minimalPrompt = `${basePrompt}. Style: Clean, elegant, lots of negative space, sophisticated color palette, editorial streaming-platform aesthetic, subtle gradients.`;
    
    // Concept 3: Genre-driven
    const genrePrompt = `${basePrompt}. Style: Highly stylized, vibrant, neon-drenched or mood-specific depending on the exact genre, strong visual identity, punchy colors.`;

    console.log(`Generating AI Art Concepts:\n1. ${cinematicPrompt}\n2. ${minimalPrompt}\n3. ${genrePrompt}`);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // For the UI prototype, we return high-quality textured placeholders that represent the art styles
    // (In reality, these would be the base64 or CDN URLs of the generated AI images)
    return [
      {
        id: 'cinematic',
        label: 'Cinematic',
        backgroundUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80', // Dark cinematic texture
        promptUsed: cinematicPrompt
      },
      {
        id: 'minimal',
        label: 'Minimal Premium',
        backgroundUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80', // Clean minimal gradient/texture
        promptUsed: minimalPrompt
      },
      {
        id: 'genre',
        label: 'Genre Driven',
        backgroundUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=800&q=80', // Vibrant/stylized texture
        promptUsed: genrePrompt
      }
    ];
  }
}
