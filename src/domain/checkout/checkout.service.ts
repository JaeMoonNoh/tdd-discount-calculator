import { Injectable } from '@nestjs/common';
import { CartItemDto, CouponDto, ReceiptDto, UserTier } from './checkout.dto';
import { CouponCollection, Receipt } from './checkout.domain';

@Injectable()
export class CheckoutCalculateService {
  calculateReceipt(
    cartItems: CartItemDto[],
    rawCoupons: CouponDto[],
    userTier: UserTier,
  ): ReceiptDto {
    const coupons = new CouponCollection(rawCoupons);
    const receipt = Receipt.createFromCart(cartItems);

    receipt.applyItemCoupons(coupons.getItemCoupons(), cartItems);
    receipt.applyCartCoupons(coupons.getCartCoupons());
    receipt.calculateRewardPoints(userTier);

    return receipt.toDto();
  }
}