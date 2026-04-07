import { Test, TestingModule } from '@nestjs/testing';
import Decimal from 'decimal.js';
import { CheckoutCalculateService } from './checkout.service';
import { CartItemDto, CouponDto } from './checkout.dto';

describe('CheckoutCalculateService (V2 Proration Engine)', () => {
  let service: CheckoutCalculateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CheckoutCalculateService],
    }).compile();

    service = module.get<CheckoutCalculateService>(CheckoutCalculateService);
  });

  const createItem = (id: string, price: number, qty: number, category: string) =>
    new CartItemDto(id, new Decimal(price), qty, category);

  const createItemCoupon = (id: string, targetId: string, percent: number, exclude?: string[]) =>
    new CouponDto(id, 'ITEM', 'PERCENT', new Decimal(percent), targetId, exclude);

  const createCartCoupon = (id: string, discount: number, minOrder?: number) =>
    new CouponDto(id, 'CART', 'FIXED', new Decimal(discount), undefined, undefined, minOrder ? new Decimal(minOrder) : undefined);

  describe('calculateReceipt - V2 정산 및 안분 비례 요구사항 검증', () => {
    
    it('요구사항 1 [Proration]: 10,000원을 3개로 안분 비례 시, 무한 소수(3333.3...) 자투리를 마지막 상품에 몰아주어 총액을 맞춘다', () => {
      // 10,000원짜리 상품 3개 (총 30,000원)
      const items = [
        createItem('p1', 10000, 1, 'FOOD'),
        createItem('p2', 10000, 1, 'FOOD'),
        createItem('p3', 10000, 1, 'FOOD'),
      ];
      // 10,000원짜리 장바구니 할인 쿠폰
      const coupons = [createCartCoupon('c_cart', 10000)];

      const result = service.calculateReceipt(items, coupons, 'BRONZE');

      // 정산 내역 검증: 3333, 3333, 3334로 정확히 쪼개졌는가?
      expect(result.items[0].cartDiscountProrationAmount.toNumber()).toBe(3333);
      expect(result.items[1].cartDiscountProrationAmount.toNumber()).toBe(3333);
      expect(result.items[2].cartDiscountProrationAmount.toNumber()).toBe(3334); // 자투리 몰아주기!
      
      // 총 할인액이 정확히 10,000원인가?
      expect(result.totalCartDiscountAmount.toNumber()).toBe(10000);
      expect(result.finalPaymentAmount.toNumber()).toBe(20000);
    });

    it('요구사항 2 [Hierarchy & Constraints]: 제외 카테고리를 피하고, 할인된 후의 금액이 "최소 주문 금액"을 넘길 때만 장바구니 쿠폰이 적용된다', () => {
      const items = [
        createItem('p_elec', 60000, 1, 'ELEC'),   // 60,000원 (전자기기)
        createItem('p_cloth', 40000, 1, 'CLOTH'), // 40,000원 (의류)
      ]; // 총액: 100,000원

      const coupons = [
        // 1. 상품 쿠폰: 의류 50% 할인 (20,000원 할인)
        createItemCoupon('c_item', 'p_cloth', 0.5),
        // 2. 장바구니 쿠폰: 10,000원 고정 할인. (단, 최소 주문 금액 80,000원)
        createCartCoupon('c_cart', 10000, 80000),
      ];

      // [계산 흐름]
      // 1. 상품 할인이 먼저 들어감: p_cloth가 4만 -> 2만이 됨. (현재 총합: 6만 + 2만 = 80,000원)
      // 2. 장바구니 쿠폰 최소 주문 금액(80,000원) 아슬아슬하게 통과, 10,000원 할인 적용.
      // 3. 안분 비례 계산:
      //    - p_elec 비중: 6만 / 8만 = 75% -> 10,000원의 75% = 7,500원 할인
      //    - p_cloth 비중: 2만 / 8만 = 25% -> 10,000원의 25% = 2,500원 할인

      const result = service.calculateReceipt(items, coupons, 'GOLD');

      // 검증 1: 상품 쿠폰이 p_cloth에만 들어갔는가?
      expect(result.items.find(i => i.productId === 'p_cloth')!.itemDiscountAmount.toNumber()).toBe(20000);
      expect(result.items.find(i => i.productId === 'p_elec')!.itemDiscountAmount.toNumber()).toBe(0);

      // 검증 2: 장바구니 쿠폰 안분이 (할인 후 가격 비중대로) 7500 / 2500 으로 쪼개졌는가?
      expect(result.items.find(i => i.productId === 'p_elec')!.cartDiscountProrationAmount.toNumber()).toBe(7500);
      expect(result.items.find(i => i.productId === 'p_cloth')!.cartDiscountProrationAmount.toNumber()).toBe(2500);

      // 최종 금액 검증: 10만 - 2만(상품) - 1만(장바구니) = 70,000원
      expect(result.finalPaymentAmount.toNumber()).toBe(70000);
    });

  });
});