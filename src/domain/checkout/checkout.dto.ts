import Decimal from 'decimal.js';

// 기획자와 소통할 때 사용할 공통 할인 타입 및 유저 등급
// 정액 할인, 정률 할인
// 회원 등급
export type CouponType = 'FIXED' | 'PERCENT';
export type UserTier = 'BRONZE' | 'SILVER' | 'GOLD';

// 1. 장바구니에 담긴 개별 상품

export class CartItemDto {
  constructor(
    public readonly productId: string,
    public readonly price: Decimal,
    public readonly quantity: number,
  ) {}

  getTotalPrice(): Decimal {
    return this.price.times(this.quantity);
  }
}

// 2. 결제 시 적용할 쿠폰 정책
// FIXED면 할인 금액(원), PERCENT면 할인율(예: 0.1 = 10%)
// PERCENT 할인일 때 적용되는 최대 할인 한도 (Max Cap)
export class CouponDto {
  constructor(
    public readonly couponId: string,
    public readonly type: CouponType,
    public readonly value: Decimal,
    public readonly maxDiscountAmount?: Decimal,
  ) {}
}

// 3. 계산이 모두 끝난 최종 영수증 (출력 결과물)
 // 할인 전 총 상품 금액
 // 총 할인 금액
 // 최종 결제 금액
 // 적립 예정 포인트
export class ReceiptDto {
  constructor(
    public readonly originalTotalAmount: Decimal,
    public readonly totalDiscountAmount: Decimal, 
    public readonly finalPaymentAmount: Decimal,  
    public readonly accumulatedPoints: Decimal,
  ) {}
}