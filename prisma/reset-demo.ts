import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning all transactional order, payment, ledger, and test data...');

  // Delete in FK-safe child-to-parent order
  await prisma.notificationLog.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.stripeEvent.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.stationTicket.deleteMany();
  await prisma.couponRedemption.deleteMany();
  await prisma.loyaltyTransaction.deleteMany();
  await prisma.order.deleteMany();
  await prisma.orderCounter.deleteMany();
  await prisma.cashMovement.deleteMany();
  await prisma.cashSession.deleteMany();
  await prisma.goodsReceiptLine.deleteMany();
  await prisma.goodsReceipt.deleteMany();
  await prisma.purchaseOrderLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.inventoryTransaction.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.financialTransaction.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.staffSession.deleteMany();
  await prisma.customerSession.deleteMany();
  await prisma.customerFavourite.deleteMany();
  await prisma.customerAddress.deleteMany();

  // Reset coupons usage count
  await prisma.coupon.updateMany({ data: { usedCount: 0 } });

  // Reset starting inventory levels
  const store = await prisma.store.findUniqueOrThrow({ where: { slug: 'star-kebab' } });
  const resetLevels: Record<string, string> = {
    'ING-LAMB': '45.000',
    'ING-CHKN': '40.000',
    'ING-FLOUR': '50.000',
    'ING-CHIPS': '60.000',
    'ING-CHEESE': '18.000',
    'ING-BREAD': '200.000',
  };
  for (const [code, onHand] of Object.entries(resetLevels)) {
    await prisma.inventoryItem.updateMany({
      where: { storeId: store.id, code },
      data: { onHand },
    });
  }

  // Ensure ONLY clean demo users exist (Admin Usama, Demo Staff Liam & Jack, Demo Customer Oliver)
  const superAdminRole = await prisma.role.findUniqueOrThrow({
    where: { storeId_name: { storeId: store.id, name: 'Super Admin' } },
  });
  const counterRole = await prisma.role.findUniqueOrThrow({
    where: { storeId_name: { storeId: store.id, name: 'Counter Staff' } },
  });
  const kitchenRole = await prisma.role.findUniqueOrThrow({
    where: { storeId_name: { storeId: store.id, name: 'Kitchen Chef' } },
  });

  // Remove old seed emails if present
  await prisma.userPermissionGrant.deleteMany({
    where: { staffUser: { email: { notIn: ['admin@starkebab.com.au', 'staff@starkebab.com.au', 'chef@starkebab.com.au'] } } },
  });
  await prisma.staffUser.deleteMany({
    where: { email: { notIn: ['admin@starkebab.com.au', 'staff@starkebab.com.au', 'chef@starkebab.com.au'] } },
  });

  const adminPass = await bcrypt.hash('StarAdmin123!', 10);
  const staffPass = await bcrypt.hash('StarStaff123!', 10);
  const custPass = await bcrypt.hash('Customer123!', 10);
  const pin1111 = await bcrypt.hash('1111', 10);
  const pin2222 = await bcrypt.hash('2222', 10);
  const pin3333 = await bcrypt.hash('3333', 10);

  await prisma.staffUser.upsert({
    where: { email: 'admin@starkebab.com.au' },
    update: { name: 'Usama (Owner)', passwordHash: adminPass, pinHash: pin1111, roleId: superAdminRole.id, active: true, pinFailedCount: 0, pinLockedUntil: null },
    create: { storeId: store.id, email: 'admin@starkebab.com.au', name: 'Usama (Owner)', passwordHash: adminPass, pinHash: pin1111, roleId: superAdminRole.id },
  });

  await prisma.staffUser.upsert({
    where: { email: 'staff@starkebab.com.au' },
    update: { name: "Liam O'Connor (Counter Staff)", passwordHash: staffPass, pinHash: pin2222, roleId: counterRole.id, active: true, pinFailedCount: 0, pinLockedUntil: null },
    create: { storeId: store.id, email: 'staff@starkebab.com.au', name: "Liam O'Connor (Counter Staff)", passwordHash: staffPass, pinHash: pin2222, roleId: counterRole.id },
  });

  await prisma.staffUser.upsert({
    where: { email: 'chef@starkebab.com.au' },
    update: { name: 'Jack Thompson (Grill Chef)', passwordHash: staffPass, pinHash: pin3333, roleId: kitchenRole.id, active: true, pinFailedCount: 0, pinLockedUntil: null },
    create: { storeId: store.id, email: 'chef@starkebab.com.au', name: 'Jack Thompson (Grill Chef)', passwordHash: staffPass, pinHash: pin3333, roleId: kitchenRole.id },
  });

  // Clean customers & keep only Oliver Smith demo customer
  await prisma.loyaltyAccount.deleteMany({
    where: { customer: { email: { not: 'oliver@starkebab.com.au' } } },
  });
  await prisma.customer.deleteMany({
    where: { email: { not: 'oliver@starkebab.com.au' } },
  });

  const oliver = await prisma.customer.upsert({
    where: { email: 'oliver@starkebab.com.au' },
    update: { name: 'Oliver Smith', phone: '0412 345 678', passwordHash: custPass, emailVerified: true },
    create: { email: 'oliver@starkebab.com.au', name: 'Oliver Smith', phone: '0412 345 678', passwordHash: custPass, emailVerified: true },
  });

  await prisma.loyaltyAccount.upsert({
    where: { customerId: oliver.id },
    update: { balance: 250 },
    create: { customerId: oliver.id, balance: 250 },
  });

  console.log('✅ Database cleaned! 0 orders, 0 test ledgers. Clean demo users ready:');
  console.log('   Admin (/admin/login):      admin@starkebab.com.au  / StarAdmin123! — Usama (Owner)');
  console.log("   Staff (/staff/login):      staff@starkebab.com.au  / StarStaff123! — Liam O'Connor (PIN 2222)");
  console.log('   Chef  (/staff/login):      chef@starkebab.com.au   / StarStaff123! — Jack Thompson (PIN 3333)');
  console.log('   Customer (/account/login): oliver@starkebab.com.au / Customer123!  — Oliver Smith');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
