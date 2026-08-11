import { JwtService } from '@nestjs/jwt';
export declare class AuthService {
    private jwtService;
    constructor(jwtService: JwtService);
    login(password: string): Promise<{
        access_token: string;
    }>;
}
