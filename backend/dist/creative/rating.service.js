"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RatingAggregationService = void 0;
const common_1 = require("@nestjs/common");
let RatingAggregationService = class RatingAggregationService {
    getRating(manualRating, sources) {
        if (manualRating !== null && manualRating !== undefined) {
            return {
                mode: 'MANUAL',
                displayString: `⭐ ${manualRating.toFixed(2)}/5`,
                value: manualRating
            };
        }
        if (!sources || sources.length === 0) {
            return {
                mode: 'NOT_AVAILABLE',
                displayString: 'RATING NOT AVAILABLE',
                value: null
            };
        }
        let totalScore = 0;
        let totalWeight = 0;
        for (const src of sources) {
            const normalized = (src.rating / src.maximumRating) * 5.0;
            const weight = src.voteCount > 1000 ? 1.5 : (src.voteCount > 0 ? 1.0 : 0.5);
            totalScore += (normalized * weight);
            totalWeight += weight;
        }
        if (totalWeight === 0) {
            return {
                mode: 'NOT_AVAILABLE',
                displayString: 'RATING NOT AVAILABLE',
                value: null
            };
        }
        const aggregated = totalScore / totalWeight;
        return {
            mode: 'AGGREGATED',
            displayString: `⭐ ${aggregated.toFixed(2)}/5 (Aggregated)`,
            value: aggregated
        };
    }
};
exports.RatingAggregationService = RatingAggregationService;
exports.RatingAggregationService = RatingAggregationService = __decorate([
    (0, common_1.Injectable)()
], RatingAggregationService);
//# sourceMappingURL=rating.service.js.map