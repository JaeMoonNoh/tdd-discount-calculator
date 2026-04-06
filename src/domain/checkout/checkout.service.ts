import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { CartItemDto, CouponDto, ReceiptDto, UserTier } from './checkout.dto';

@Injectable()
export class CheckoutCalculateService {
  private readonly pointRates: Record<UserTier, Decimal> = {
    BRONZE: new Decimal('0.01'),
    SILVER: new Decimal('0.03'),
    GOLD: new Decimal('0.05'),
  };

  calculateReceipt(
    cartItems: CartItemDto[],
    coupons: CouponDto[],
    userTier: UserTier,
  ): ReceiptDto {
    const originalTotal = cartItems.reduce(
      (acc, item) => acc.add(item.getTotalPrice()),
      new Decimal(0),
    );

    let finalPayment = originalTotal;
    let totalDiscount = new Decimal(0);

    for (const coupon of coupons) {
      // 리팩토링 포인트 1: 할인액 계산 책임을 별도 메서드로 위임 (추상화 수준 맞추기)
      const discountAmount = this.calculateDiscountAmount(finalPayment, coupon);

      finalPayment = finalPayment.minus(discountAmount);
      totalDiscount = totalDiscount.add(discountAmount);

      // 리팩토링 포인트 2: 마이너스 결제 방어 로직도 별도 메서드로 추출
      const adjusted = this.preventNegativePayment(finalPayment, totalDiscount);
      finalPayment = adjusted.finalPayment;
      totalDiscount = adjusted.totalDiscount;

      if (finalPayment.isZero()) break;
    }

    const accumulatedPoints = finalPayment.times(this.pointRates[userTier]).floor();

    return new ReceiptDto(originalTotal, totalDiscount, finalPayment, accumulatedPoints);
  }

  // --- 은닉된 세부 구현 메서드들 (Private) ---

  private calculateDiscountAmount(currentAmount: Decimal, coupon: CouponDto): Decimal {
    switch (coupon.type) {
      case 'FIXED':
        return coupon.value;
      
      case 'PERCENT': {
        const calculatedDiscount = currentAmount.times(coupon.value).floor();
        return this.applyMaxCap(calculatedDiscount, coupon.maxDiscountAmount);
      }
      
      default:
        return new Decimal(0); // 알 수 없는 쿠폰 타입 방어
    }
  }

  private applyMaxCap(discount: Decimal, maxCap?: Decimal): Decimal {
    if (maxCap && discount.greaterThan(maxCap)) {
      return maxCap;
    }
    return discount;
  }

  private preventNegativePayment(finalPayment: Decimal, totalDiscount: Decimal) {
    if (finalPayment.isNegative()) {
      return {
        totalDiscount: totalDiscount.minus(finalPayment.abs()),
        finalPayment: new Decimal(0),
      };
    }
    return { finalPayment, totalDiscount };
  }
}