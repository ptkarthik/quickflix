import { ContentGeneratorService } from './content-generator.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class AiController {
    private readonly generatorService;
    private readonly prisma;
    constructor(generatorService: ContentGeneratorService, prisma: PrismaService);
    generateAll(id: string): Promise<{
        review: {
            synopsis: string;
            oneLiner: string;
            rating: number;
            detailedReview: string;
            twoLiner?: undefined;
            shortReview?: undefined;
            pros?: undefined;
            cons?: undefined;
            verdict?: undefined;
        } | {
            oneLiner: string;
            twoLiner: string;
            shortReview: string;
            detailedReview: string;
            pros: string[];
            cons: string[];
            verdict: string;
            synopsis?: undefined;
            rating?: undefined;
        };
        instagram: {
            synopsis: string;
            oneLiner: string;
            rating: number;
            detailedReview: string;
            twoLiner?: undefined;
            shortReview?: undefined;
            pros?: undefined;
            cons?: undefined;
            verdict?: undefined;
        } | {
            oneLiner: string;
            twoLiner: string;
            shortReview: string;
            detailedReview: string;
            pros: string[];
            cons: string[];
            verdict: string;
            synopsis?: undefined;
            rating?: undefined;
        };
        youtube: {
            synopsis: string;
            oneLiner: string;
            rating: number;
            detailedReview: string;
            twoLiner?: undefined;
            shortReview?: undefined;
            pros?: undefined;
            cons?: undefined;
            verdict?: undefined;
        } | {
            oneLiner: string;
            twoLiner: string;
            shortReview: string;
            detailedReview: string;
            pros: string[];
            cons: string[];
            verdict: string;
            synopsis?: undefined;
            rating?: undefined;
        };
    }>;
    generateSpecific(id: string, type: string): Promise<{
        synopsis: string;
        oneLiner: string;
        rating: number;
        detailedReview: string;
        twoLiner?: undefined;
        shortReview?: undefined;
        pros?: undefined;
        cons?: undefined;
        verdict?: undefined;
    } | {
        oneLiner: string;
        twoLiner: string;
        shortReview: string;
        detailedReview: string;
        pros: string[];
        cons: string[];
        verdict: string;
        synopsis?: undefined;
        rating?: undefined;
    }>;
    saveEditedContent(id: string, type: string, body: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        projectId: string;
        type: string;
        content: string;
    }>;
}
