import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
export declare class ProjectsController {
    private readonly projectsService;
    constructor(projectsService: ProjectsService);
    create(createProjectDto: CreateProjectDto): import(".prisma/client").Prisma.Prisma__MovieProjectClient<{
        id: string;
        language: string | null;
        createdAt: Date;
        updatedAt: Date;
        genre: string | null;
        title: string;
        status: string;
        rating: number | null;
        releaseYear: number | null;
        oneLiner: string | null;
        review: string | null;
        researchFetchedAt: Date | null;
        researchVersion: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    findAll(): import(".prisma/client").Prisma.PrismaPromise<({
        assets: {
            id: string;
            createdAt: Date;
            projectId: string;
            type: string;
            filename: string;
            originalName: string;
            mimeType: string;
            path: string;
            isGenerated: boolean;
            width: number | null;
            height: number | null;
            template: string | null;
            format: string | null;
        }[];
    } & {
        id: string;
        language: string | null;
        createdAt: Date;
        updatedAt: Date;
        genre: string | null;
        title: string;
        status: string;
        rating: number | null;
        releaseYear: number | null;
        oneLiner: string | null;
        review: string | null;
        researchFetchedAt: Date | null;
        researchVersion: string | null;
    })[]>;
    findOne(id: string): import(".prisma/client").Prisma.Prisma__MovieProjectClient<({
        generatedContent: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            projectId: string;
            status: string;
            type: string;
            version: number;
            content: string;
            model: string;
            promptVersion: string | null;
        }[];
        editedContent: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            projectId: string;
            type: string;
            content: string;
        }[];
        assets: {
            id: string;
            createdAt: Date;
            projectId: string;
            type: string;
            filename: string;
            originalName: string;
            mimeType: string;
            path: string;
            isGenerated: boolean;
            width: number | null;
            height: number | null;
            template: string | null;
            format: string | null;
        }[];
    } & {
        id: string;
        language: string | null;
        createdAt: Date;
        updatedAt: Date;
        genre: string | null;
        title: string;
        status: string;
        rating: number | null;
        releaseYear: number | null;
        oneLiner: string | null;
        review: string | null;
        researchFetchedAt: Date | null;
        researchVersion: string | null;
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    update(id: string, updateProjectDto: UpdateProjectDto): import(".prisma/client").Prisma.Prisma__MovieProjectClient<{
        id: string;
        language: string | null;
        createdAt: Date;
        updatedAt: Date;
        genre: string | null;
        title: string;
        status: string;
        rating: number | null;
        releaseYear: number | null;
        oneLiner: string | null;
        review: string | null;
        researchFetchedAt: Date | null;
        researchVersion: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    remove(id: string): import(".prisma/client").Prisma.Prisma__MovieProjectClient<{
        id: string;
        language: string | null;
        createdAt: Date;
        updatedAt: Date;
        genre: string | null;
        title: string;
        status: string;
        rating: number | null;
        releaseYear: number | null;
        oneLiner: string | null;
        review: string | null;
        researchFetchedAt: Date | null;
        researchVersion: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
}
