import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { PaymentsWebhookController } from './payments-webhook.controller';
import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';

@Module({
  imports: [PaymentsModule],
  controllers: [
    ProductsController,
    OrdersController,
    PaymentsWebhookController,
  ],
  providers: [ProductsService, OrdersService],
})
export class BullseyeModule {}
