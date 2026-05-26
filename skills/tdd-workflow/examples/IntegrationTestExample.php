<?php
namespace tests\Feature;

use tests\TestCase;
use think\Db;

/**
 * Example Integration Test for TheOMS
 * 
 * This test demonstrates how to test API endpoints in ThinkPHP 5.0.
 */
class ApiOrderTest extends TestCase
{
    /** @test */
    public function it_returns_order_list_successfully()
    {
        // 1. Arrange: Ensure there's data in the database
        Db::name('order')->insert([
            'order_no'    => 'ORD-2026-04-01-001',
            'customer_id' => 1,
            'amount'      => 100.50,
            'create_time' => time(),
        ]);

        // 2. Act: Send a request to the API
        $response = $this->get('/api/order/index');

        // 3. Assert: Verify the response
        $this->assertEquals(200, $response->getStatusCode());
        $this->assertStringContainsString('ORD-2026-04-01-001', $response->getContent());

        // 4. Cleanup: Delete the record
        Db::name('order')->where('order_no', 'ORD-2026-04-01-001')->delete();
    }
}
