import Decimal from 'decimal.js';

export type CouponType = 'FIXED' | 'PERCENT';
export type CouponScope = 'ITEM' | 'CART'; // [V2 추가] 쿠폰의 적용 범위
export type UserTier = 'BRONZE' | 'SILVER' | 'GOLD';

/**
 * 1. 장바구니 상품
 */
export class CartItemDto {
  constructor(
    public readonly productId: string,
    public readonly price: Decimal,
    public readonly quantity: number,
    public readonly category: string, // [V2 추가] 카테고리 제외 룰을 위한 필드
  ) {}

  getTotalPrice(): Decimal {
    return this.price.times(this.quantity);
  }
}

/**
 * 2. 복합 쿠폰 정책
 */
export class CouponDto {
  constructor(
    public readonly couponId: string,
    public readonly scope: CouponScope, // ITEM(상품 적용) or CART(장바구니 전체 적용)
    public readonly type: CouponType,
    public readonly value: Decimal,
    
    // --- [V2 추가] 제약 조건 (Constraints) ---
    public readonly targetProductId?: string,       // ITEM 쿠폰일 경우 대상 상품 ID
    public readonly excludedCategories?: string[],  // 적용 제외 카테고리
    public readonly minOrderValue?: Decimal,        // CART 쿠폰용 최소 주문 금액
    public readonly maxDiscountAmount?: Decimal,    // PERCENT 쿠폰용 최대 할인 한도
  ) {}
}

/**
 * 3. [V2 핵심] 개별 상품 영수증 내역 (정산 및 안분 비례용)
 */
export class ReceiptItemDto {
  constructor(
    public readonly productId: string,
    public readonly originalAmount: Decimal,             // 원래 상품 가격 총합 (단가 * 수량)
    public readonly itemDiscountAmount: Decimal,         // 상품 쿠폰으로 할인받은 금액
    public readonly cartDiscountProrationAmount: Decimal,// 장바구니 쿠폰으로 '안분(쪼개져서)' 받은 할인 금액
    public readonly finalAmount: Decimal,                // 이 상품의 최종 결제 금액
  ) {}
}

/**
 * 4. 최종 영수증 (출력물)
 */
export class ReceiptDto {
  constructor(
    public readonly items: ReceiptItemDto[], // [V2 추가] 이제 총액뿐만 아니라 항목별 상세 정산 내역을 가집니다.
    public readonly originalTotalAmount: Decimal,
    public readonly totalItemDiscountAmount: Decimal, // 상품 할인 총합
    public readonly totalCartDiscountAmount: Decimal, // 장바구니 할인 총합
    public readonly finalPaymentAmount: Decimal,
    public readonly accumulatedPoints: Decimal,
  ) {}
}