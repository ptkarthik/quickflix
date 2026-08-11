import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(password: string) {
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    if (password !== adminPassword) {
      throw new UnauthorizedException('Invalid password');
    }
    const payload = { role: 'Admin' };
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}
