<?php
namespace tests\Unit;

use tests\TestCase;
use think\Model;

/**
 * Example Unit Test for TheOMS
 * 
 * This test demonstrates how to test standalone logic in ThinkPHP 5.0.
 */
class OrderLogicTest extends TestCase
{
    /** @test */
    public function it_calculates_total_price_with_discount()
    {
        // 1. Arrange: Setup initial state
        $items = [
            ['price' => 100, 'qty' => 2],
            ['price' => 50, 'qty' => 1],
        ];
        $discount = 20;

        // 2. Act: Call the logic
        $total = $this->calculateTotal($items, $discount);

        // 3. Assert: Verify the result
        $this->assertEquals(230, $total);
    }

    private function calculateTotal($items, $discount)
    {
        $total = 0;
        foreach ($items as $item) {
            $total += $item['price'] * $item['qty'];
        }
        return $total - $discount;
    }
}
