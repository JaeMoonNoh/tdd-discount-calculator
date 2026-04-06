import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { CartItemDto, CouponDto, ReceiptDto, UserTier } from './checkout.dto';

@Injectable()
export class CheckoutCalculateService {
  // 등급별 적립률 정책 (도메인 룰)
  private readonly pointRates: Record<UserTier, Decimal> = {
    BRONZE: new Decimal('0.01'), // 1%
    SILVER: new Decimal('0.03'), // 3%
    GOLD: new Decimal('0.05'),   // 5%
  };

  calculateReceipt(
    cartItems: CartItemDto[],
    coupons: CouponDto[],
    userTier: UserTier,
  ): ReceiptDto {
    // 1. 원결제 금액 계산 (장바구니 아이템 총합)
    const originalTotal = cartItems.reduce(
      (acc, item) => acc.add(item.getTotalPrice()),
      new Decimal(0),
    );

    let finalPayment = originalTotal;
    let totalDiscount = new Decimal(0);

    // 2. 쿠폰 순차 적용 (룰 엔진)
    for (const coupon of coupons) {
      let discountAmount = new Decimal(0);

      if (coupon.type === 'FIXED') {
        discountAmount = coupon.value;
      } else if (coupon.type === 'PERCENT') {
        // 정률 할인은 '현재까지 남은 결제 금액'을 기준으로 계산
        discountAmount = finalPayment.times(coupon.value).floor();
        
        // Max Cap (최대 할인 한도) 엣지 케이스 방어
        if (
          coupon.maxDiscountAmount &&
          discountAmount.greaterThan(coupon.maxDiscountAmount)
        ) {
          discountAmount = coupon.maxDiscountAmount;
        }
      }

      finalPayment = finalPayment.minus(discountAmount);
      totalDiscount = totalDiscount.add(discountAmount);

      // 3. 마이너스 결제 방어 (엣지 케이스)
      if (finalPayment.isNegative()) {
        // 초과된 할인 금액을 다시 빼서 실제 상품가만큼만 할인으로 인정
        totalDiscount = totalDiscount.minus(finalPayment.abs());
        finalPayment = new Decimal(0);
        break; // 결제 금액이 0원이 되면 남은 쿠폰은 무의미하므로 즉시 종료
      }
    }

    // 4. 최종 적립 포인트 계산
    const accumulatedPoints = finalPayment
      .times(this.pointRates[userTier])
      .floor();

    return new ReceiptDto(
      originalTotal,
      totalDiscount,
      finalPayment,
      accumulatedPoints,
    );
  }
}