import Decimal from 'decimal.js';
import { CartItemDto, CouponDto, ReceiptDto, ReceiptItemDto, UserTier } from './checkout.dto';

export class CouponCollection {
  constructor(private readonly coupons: CouponDto[]) {}

  getItemCoupons(): CouponDto[] {
    return this.coupons.filter((c) => c.scope === 'ITEM');
  }

  getCartCoupons(): CouponDto[] {
    return this.coupons.filter((c) => c.scope === 'CART');
  }
}

export class Receipt {
  private items: ReceiptItemDto[];
  private accumulatedPoints: Decimal = new Decimal(0);

  private constructor(items: ReceiptItemDto[]) {
    this.items = items;
  }

  static createFromCart(cartItems: CartItemDto[]): Receipt {
    const initialItems = cartItems.map(
      (item) => new ReceiptItemDto(
        item.productId, item.getTotalPrice(), new Decimal(0), new Decimal(0), item.getTotalPrice()
      )
    );
    return new Receipt(initialItems);
  }

  // 1. 상품 쿠폰 적용 로직
  applyItemCoupons(coupons: CouponDto[], originalCart: CartItemDto[]): void {
    if (coupons.length === 0) return;

    this.items = this.items.map((item) => {
      const targetCoupon = coupons.find((c) => c.targetProductId === item.productId);
      if (!targetCoupon) return item;

      const category = originalCart.find((c) => c.productId === item.productId)?.category;
      if (category && targetCoupon.excludedCategories?.includes(category)) return item;

      const discount = this.calculateDiscount(item.originalAmount, targetCoupon);
      const finalAmount = Decimal.max(0, item.originalAmount.minus(discount));

      return new ReceiptItemDto(item.productId, item.originalAmount, discount, item.cartDiscountProrationAmount, finalAmount);
    });
  }

  // 2. 장바구니 쿠폰 적용 및 안분비례(Proration) 로직
  applyCartCoupons(coupons: CouponDto[]): void {
    if (coupons.length === 0) return;

    for (const coupon of coupons) {
      const currentTotal = this.getCurrentTotal();
      if (coupon.minOrderValue && currentTotal.lessThan(coupon.minOrderValue)) continue;

      const discountToApply = this.calculateDiscount(currentTotal, coupon);
      if (discountToApply.isZero()) continue;

      this.distributeCartDiscount(discountToApply, currentTotal);
    }
  }

  // 3. 포인트 적립 계산 로직
  calculateRewardPoints(userTier: UserTier): void {
    const rates: Record<UserTier, Decimal> = {
      BRONZE: new Decimal('0.01'), SILVER: new Decimal('0.03'), GOLD: new Decimal('0.05'),
    };
    this.accumulatedPoints = this.getCurrentTotal().times(rates[userTier]).floor();
  }

  // 최종 DTO 반환 로직 
  toDto(): ReceiptDto {
    const originalTotal = this.items.reduce((acc, i) => acc.add(i.originalAmount), new Decimal(0));
    const totalItemDiscount = this.items.reduce((acc, i) => acc.add(i.itemDiscountAmount), new Decimal(0));
    const totalCartDiscount = this.items.reduce((acc, i) => acc.add(i.cartDiscountProrationAmount), new Decimal(0));
    const finalPayment = this.getCurrentTotal();

    return new ReceiptDto(this.items, originalTotal, totalItemDiscount, totalCartDiscount, finalPayment, this.accumulatedPoints);
  }

  private getCurrentTotal(): Decimal {
    return this.items.reduce((acc, i) => acc.add(i.finalAmount), new Decimal(0));
  }

  private calculateDiscount(baseAmount: Decimal, coupon: CouponDto): Decimal {
    let discount = coupon.type === 'FIXED' ? coupon.value : baseAmount.times(coupon.value).floor();
    if (coupon.maxDiscountAmount && discount.greaterThan(coupon.maxDiscountAmount)) {
      discount = coupon.maxDiscountAmount;
    }
    return Decimal.min(baseAmount, discount);
  }

  private distributeCartDiscount(totalDiscount: Decimal, totalAmount: Decimal): void {
    if (totalAmount.isZero()) return;
    let remainingDiscount = totalDiscount;

    this.items = this.items.map((item, index) => {
      let prorationDiscount = (index === this.items.length - 1) 
        ? remainingDiscount 
        : totalDiscount.times(item.finalAmount.div(totalAmount)).floor();
        
      remainingDiscount = remainingDiscount.minus(prorationDiscount);
      const newFinalAmount = Decimal.max(0, item.finalAmount.minus(prorationDiscount));

      return new ReceiptItemDto(item.productId, item.originalAmount, item.itemDiscountAmount, item.cartDiscountProrationAmount.add(prorationDiscount), newFinalAmount);
    });
  }
}