export interface MovieResearchProvider {
    searchMovie(title: string, year?: number): Promise<any[]>;
    getMovieDetails(id: string | number): Promise<ResearchData>;
}
export interface ResearchData {
    title: string;
    synopsis: string;
    releaseDate: string;
    genres: string[];
    director: string;
    cast: string[];
    runtime: number;
    productionInfo: string;
}
