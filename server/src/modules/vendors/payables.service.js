'use strict';

/**
 * Vendor payables. A vendor *bill* is an Expense with vendorId (raised from a
 * goods receipt, a material purchase, or entered directly). Vendor *payments*
 * settle bills through allocations; any part of a payment not allocated to a
 * bill is an *advance* that can be applied to later bills.
 * Expense.amountPaid always equals the paid-at-entry part plus allocations.
 */
const { Prisma } = require('@prisma/client');
const prisma = require('../../config/prisma');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');
const { projectNames } = require('../../core/services/people');

const num = (v) => Number(v || 0);
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const D = (v) => new Prisma.Decimal(r2(num(v)));
const today = () => new Date(new Date().toDateString());
const statusFor = (amount, paid) => (paid >= amount - 0.005 ? 'PAID' : paid > 0.005 ? 'PARTIAL' : 'CREDIT');

async function assertVendor(id) {
  const v = await prisma.vendor.findFirst({ where: { id, deletedAt: null } });
  if (!v) throw AppError.notFound('Vendor not found');
  return v;
}

function billView(e, projects) {
  const amount = num(e.amount);
  const paid = num(e.amountPaid);
  const balance = r2(Math.max(0, amount - paid));
  const due = e.dueDate ? new Date(e.dueDate) : null;
  const daysOverdue = balance > 0 && due && due < today() ? Math.floor((today() - due) / 86400000) : 0;
  return {
    id: e.id, date: e.date, billNumber: e.billNumber, dueDate: e.dueDate, category: e.category, notes: e.notes,
    projectId: e.projectId, projectName: e.projectId ? projects.get(e.projectId)?.name || null : null,
    purchaseOrderId: e.purchaseOrderId, amount: r2(amount), paid: r2(paid), balance,
    status: balance <= 0 ? 'paid' : daysOverdue > 0 ? 'overdue' : paid > 0 ? 'partial' : 'unpaid',
    daysOverdue,
  };
}

async function unallocated(vendorId, tx = prisma) {
  const pays = await tx.vendorPayment.findMany({ where: { vendorId, deletedAt: null }, include: { allocations: true }, orderBy: [{ date: 'asc' }, { id: 'asc' }] });
  return pays.map((p) => ({ ...p, free: r2(num(p.amount) - p.allocations.reduce((s, a) => s + num(a.amount), 0)) }));
}

// Allocate `amount` from `paymentId` across open bills (explicit or oldest-due first).
async function allocate(tx, vendorId, paymentId, amount, explicit) {
  const bills = await tx.expense.findMany({ where: { vendorId }, orderBy: [{ dueDate: 'asc' }, { date: 'asc' }, { id: 'asc' }] });
  const open = bills.filter((b) => num(b.amount) - num(b.amountPaid) > 0.005);
  const plan = [];
  if (explicit?.length) {
    for (const a of explicit) {
      const b = open.find((x) => x.id === a.expenseId);
      if (!b) throw AppError.badRequest('A selected bill is already paid or does not belong to this vendor');
      const bal = r2(num(b.amount) - num(b.amountPaid));
      if (a.amount > bal + 0.005) throw AppError.badRequest(`Bill ${b.billNumber || `#${b.id}`} only has ${bal} outstanding`);
      plan.push({ bill: b, amount: r2(a.amount) });
    }
    if (plan.reduce((s, p) => s + p.amount, 0) > amount + 0.005) throw AppError.badRequest('Allocated more than the payment amount');
  } else {
    // Bills without a due date are ordered after dated ones (MySQL sorts NULL first).
    const ordered = [...open.filter((b) => b.dueDate), ...open.filter((b) => !b.dueDate)];
    let left = amount;
    for (const b of ordered) {
      if (left <= 0.005) break;
      const take = r2(Math.min(left, num(b.amount) - num(b.amountPaid)));
      plan.push({ bill: b, amount: take });
      left = r2(left - take);
    }
  }
  for (const p of plan) {
    if (p.amount <= 0) continue;
    await tx.vendorPaymentAllocation.create({ data: { paymentId, expenseId: p.bill.id, amount: D(p.amount) } });
    const paid = r2(num(p.bill.amountPaid) + p.amount);
    await tx.expense.update({ where: { id: p.bill.id }, data: { amountPaid: D(paid), paymentStatus: statusFor(num(p.bill.amount), paid) } });
  }
  return plan.reduce((s, p) => s + p.amount, 0);
}

const payables = {
  async statement(vendorId) {
    const vendor = await assertVendor(vendorId);
    const [bills, pays] = await Promise.all([
      prisma.expense.findMany({ where: { vendorId }, orderBy: [{ date: 'desc' }, { id: 'desc' }] }),
      prisma.vendorPayment.findMany({ where: { vendorId, deletedAt: null }, include: { allocations: true }, orderBy: [{ date: 'desc' }, { id: 'desc' }] }),
    ]);
    const projects = await projectNames(bills.map((b) => b.projectId));
    const billRows = bills.map((b) => billView(b, projects));
    const billNo = new Map(bills.map((b) => [b.id, b.billNumber || `Bill #${b.id}`]));
    const payments = pays.map((p) => {
      const allocated = r2(p.allocations.reduce((s, a) => s + num(a.amount), 0));
      return {
        id: p.id, date: p.date, amount: r2(num(p.amount)), method: p.method, account: p.account, reference: p.reference, notes: p.notes,
        allocated, advance: r2(num(p.amount) - allocated),
        allocations: p.allocations.map((a) => ({ expenseId: a.expenseId, bill: billNo.get(a.expenseId), amount: r2(num(a.amount)) })),
      };
    });
    const sum = (arr, f) => r2(arr.reduce((s, x) => s + x[f], 0));
    const open = billRows.filter((b) => b.balance > 0);
    const aging = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
    for (const b of open) {
      const d = b.daysOverdue;
      const k = d <= 0 ? 'current' : d <= 30 ? 'd1_30' : d <= 60 ? 'd31_60' : d <= 90 ? 'd61_90' : 'd90plus';
      aging[k] = r2(aging[k] + b.balance);
    }
    return {
      vendor,
      totals: {
        billed: sum(billRows, 'amount'),
        paid: sum(billRows, 'paid'),
        outstanding: sum(open, 'balance'),
        overdue: sum(open.filter((b) => b.status === 'overdue'), 'balance'),
        advance: sum(payments, 'advance'),
        openBills: open.length,
      },
      aging,
      bills: billRows,
      payments,
    };
  },

  // Outstanding per vendor (for the vendor list and the payables report).
  async summary() {
    const [vendors, bills, pays] = await Promise.all([
      prisma.vendor.findMany({ where: { deletedAt: null }, select: { id: true, name: true, category: true, phone: true } }),
      prisma.expense.findMany({ where: { vendorId: { not: null } }, select: { vendorId: true, amount: true, amountPaid: true, dueDate: true } }),
      prisma.vendorPayment.findMany({ where: { deletedAt: null }, include: { allocations: { select: { amount: true } } } }),
    ]);
    const by = new Map(vendors.map((v) => [v.id, { ...v, billed: 0, outstanding: 0, overdue: 0, advance: 0, nextDue: null }]));
    for (const b of bills) {
      const v = by.get(b.vendorId);
      if (!v) continue;
      const bal = num(b.amount) - num(b.amountPaid);
      v.billed += num(b.amount);
      if (bal > 0.005) {
        v.outstanding += bal;
        if (b.dueDate && new Date(b.dueDate) < today()) v.overdue += bal;
        else if (b.dueDate && (!v.nextDue || new Date(b.dueDate) < new Date(v.nextDue))) v.nextDue = b.dueDate;
      }
    }
    for (const p of pays) {
      const v = by.get(p.vendorId);
      if (v) v.advance += num(p.amount) - p.allocations.reduce((s, a) => s + num(a.amount), 0);
    }
    const rows = [...by.values()].map((v) => ({ ...v, billed: r2(v.billed), outstanding: r2(v.outstanding), overdue: r2(v.overdue), advance: r2(v.advance) }));
    const t = (f) => r2(rows.reduce((s, r) => s + r[f], 0));
    return { rows, totals: { outstanding: t('outstanding'), overdue: t('overdue'), advance: t('advance'), vendorsWithDues: rows.filter((r) => r.outstanding > 0).length } };
  },

  async createBill(vendorId, payload, actor, req) {
    await assertVendor(vendorId);
    const paidNow = r2(Math.min(num(payload.paidNow), num(payload.amount)));
    const accounts = await prisma.setting.findUnique({ where: { group_key: { group: 'finance', key: 'accounts' } } });
    const acc = payload.account || (Array.isArray(accounts?.value) && accounts.value[0] ? accounts.value[0].key : 'cash');
    const exp = await prisma.expense.create({
      data: {
        scope: payload.projectId ? 'PROJECT' : 'COMPANY', projectId: payload.projectId || null, category: payload.category || 'Materials',
        amount: D(payload.amount), amountPaid: D(paidNow), paymentStatus: statusFor(num(payload.amount), paidNow),
        date: payload.date || new Date(), method: payload.method || 'Credit', account: acc, vendorId,
        billNumber: payload.billNumber || null, dueDate: payload.dueDate || null, purchaseOrderId: payload.purchaseOrderId || null,
        notes: payload.notes || null, createdById: actor.id,
      },
    });
    activity.record({ userId: actor.id, action: 'vendor.bill_added', entityType: 'vendor', entityId: vendorId, req });
    // Use any existing advance against the new bill straight away.
    if (payload.applyAdvance !== false) await this.applyAdvance(vendorId, actor, req, true);
    return exp;
  },

  async pay(vendorId, payload, actor, req) {
    await assertVendor(vendorId);
    const amount = r2(num(payload.amount));
    if (!(amount > 0)) throw AppError.badRequest('Enter the amount paid');
    const result = await prisma.$transaction(async (tx) => {
      const p = await tx.vendorPayment.create({
        data: { vendorId, date: payload.date || new Date(), amount: D(amount), method: payload.method || 'Cash', account: payload.account || 'cash', reference: payload.reference || null, notes: payload.notes || null, createdById: actor.id },
      });
      const allocated = payload.asAdvance ? 0 : await allocate(tx, vendorId, p.id, amount, payload.allocations);
      return { ...p, allocated: r2(allocated), advance: r2(amount - allocated) };
    });
    activity.record({ userId: actor.id, action: 'vendor.payment', entityType: 'vendor', entityId: vendorId, req });
    return result;
  },

  async applyAdvance(vendorId, actor, req, silent = false) {
    await assertVendor(vendorId);
    let applied = 0;
    await prisma.$transaction(async (tx) => {
      for (const p of await unallocated(vendorId, tx)) {
        if (p.free <= 0.005) continue;
        applied += await allocate(tx, vendorId, p.id, p.free);
      }
    });
    if (!silent && applied > 0) activity.record({ userId: actor.id, action: 'vendor.advance_applied', entityType: 'vendor', entityId: vendorId, req });
    return { applied: r2(applied) };
  },

  async removePayment(paymentId, actor, req) {
    const p = await prisma.vendorPayment.findFirst({ where: { id: paymentId, deletedAt: null }, include: { allocations: true } });
    if (!p) throw AppError.notFound('Payment not found');
    await prisma.$transaction(async (tx) => {
      for (const a of p.allocations) {
        const e = await tx.expense.findUnique({ where: { id: a.expenseId } });
        if (!e) continue;
        const paid = r2(Math.max(0, num(e.amountPaid) - num(a.amount)));
        await tx.expense.update({ where: { id: e.id }, data: { amountPaid: D(paid), paymentStatus: statusFor(num(e.amount), paid) } });
      }
      await tx.vendorPaymentAllocation.deleteMany({ where: { paymentId } });
      await tx.vendorPayment.update({ where: { id: paymentId }, data: { deletedAt: new Date() } });
    });
    activity.record({ userId: actor.id, action: 'vendor.payment_deleted', entityType: 'vendor', entityId: p.vendorId, req });
    return { success: true };
  },
};

module.exports = payables;
