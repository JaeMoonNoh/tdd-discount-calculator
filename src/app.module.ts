// src/app.module.ts
import { Module } from '@nestjs/common';
import { CheckoutDomainModule } from './domain/checkout/checkout.module';

@Module({
  imports: [CheckoutDomainModule], // 도메인 모듈 장착!
})
export class AppModule {}