import { Test, TestingModule } from '@nestjs/testing';
import Decimal from 'decimal.js';
import { CheckoutCalculateService } from './checkout.service';
import { CartItemDto, CouponDto } from './checkout.dto';

describe('CheckoutCalculateService (TDD Red Phase)', () => {
  let service: CheckoutCalculateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CheckoutCalculateService],
    }).compile();

    service = module.get<CheckoutCalculateService>(CheckoutCalculateService);
  });

  // 💡 테스트 데이터 생성을 위한 팩토리 함수 (가독성 UP)
  const createItem = (price: number, qty: number) => 
    new CartItemDto('p1', new Decimal(price), qty);
  const createFixedCoupon = (amt: number) => 
    new CouponDto('c1', 'FIXED', new Decimal(amt));
  const createPercentCoupon = (rate: number, max?: number) => 
    new CouponDto('c2', 'PERCENT', new Decimal(rate), max ? new Decimal(max) : undefined);

  describe('calculateReceipt - 비즈니스 요구사항 검증', () => {
    
    it('요구사항 1: 쿠폰이 없을 때, 총 상품 금액과 포인트(1%)가 정확히 계산되어야 한다 (BRONZE)', () => {
      const items = [createItem(10000, 2)]; // 20,000원
      
      const result = service.calculateReceipt(items, [], 'BRONZE');

      expect(result.originalTotalAmount.toNumber()).toBe(20000);
      expect(result.finalPaymentAmount.toNumber()).toBe(20000);
      expect(result.accumulatedPoints.toNumber()).toBe(200); // 20000 * 0.01
    });

    it('요구사항 2: 정액 할인 쿠폰이 정상 적용되어야 한다', () => {
      const items = [createItem(50000, 1)];
      const coupons = [createFixedCoupon(10000)];
      
      const result = service.calculateReceipt(items, coupons, 'BRONZE');

      expect(result.finalPaymentAmount.toNumber()).toBe(40000);
      expect(result.totalDiscountAmount.toNumber()).toBe(10000);
    });

    it('요구사항 3: 정률 할인 시, 최대 할인 한도(Max Cap)가 적용되어야 한다', () => {
      const items = [createItem(100000, 1)];
      // 50% 할인(50,000원)이지만 한도가 30,000원인 경우
      const coupons = [createPercentCoupon(0.5, 30000)];
      
      const result = service.calculateReceipt(items, coupons, 'BRONZE');

      expect(result.totalDiscountAmount.toNumber()).toBe(30000);
      expect(result.finalPaymentAmount.toNumber()).toBe(70000);
    });

    it('요구사항 4 [Edge Case]: 할인 금액이 커서 결제 금액이 마이너스가 될 경우 0원으로 처리한다', () => {
      const items = [createItem(5000, 1)];
      const coupons = [createFixedCoupon(10000)]; // 배보다 배꼽이 더 큰 할인
      
      const result = service.calculateReceipt(items, coupons, 'BRONZE');

      expect(result.finalPaymentAmount.toNumber()).toBe(0);
      expect(result.totalDiscountAmount.toNumber()).toBe(5000); // 실제 상품가만큼만 할인으로 인정
    });

  });
});