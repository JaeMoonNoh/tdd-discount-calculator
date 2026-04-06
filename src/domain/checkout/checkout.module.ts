import { Module } from "@nestjs/common";
import { CheckoutCalculateService } from "./checkout.service";

@Module({
    providers: [CheckoutCalculateService],
    exports: [CheckoutCalculateService]
})
export class CheckoutDomainModule {}