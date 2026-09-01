import frappe
from frappe import _
from frappe.utils import flt, nowdate

from erpnext.accounts.party import get_party_account


@frappe.whitelist()
def create_booking_order(customer, items, delivery_date, advance_amount=0, mode_of_payment="Cash", company=None):
    """Create a Sales Order (and optional advance Payment Entry) for an out-of-stock
    item being booked from the POS. Runs under the calling user's own permissions so
    that only users who are actually allowed to create Sales Orders / Payment Entries
    can use this endpoint."""

    if isinstance(items, str):
        items = frappe.parse_json(items)

    if not customer:
        frappe.throw(_("Customer is required"))
    if not items:
        frappe.throw(_("At least one item is required"))
    if not delivery_date:
        frappe.throw(_("Delivery date is required"))

    if not company:
        company = frappe.defaults.get_user_default("company") or frappe.defaults.get_global_default("company")
    if not company:
        frappe.throw(_("Could not determine Company. Please pass it explicitly from the POS."))

    if not frappe.has_permission("Sales Order", "create"):
        frappe.throw(_("You are not permitted to create Sales Orders"), frappe.PermissionError)

    advance_amount = flt(advance_amount)
    if advance_amount > 0 and not frappe.has_permission("Payment Entry", "create"):
        frappe.throw(_("You are not permitted to create Payment Entries"), frappe.PermissionError)

    so = frappe.new_doc("Sales Order")
    so.customer = customer
    so.company = company
    so.delivery_date = delivery_date

    for item in items:
        item_code = item.get("item_code")
        qty = flt(item.get("qty"))
        rate = flt(item.get("rate"))

        if not item_code or qty <= 0:
            frappe.throw(_("Invalid item in cart: {0}").format(item_code or "?"))
        if not frappe.db.exists("Item", item_code):
            frappe.throw(_("Item {0} does not exist").format(item_code))

        so.append("items", {
            "item_code": item_code,
            "qty": qty,
            "rate": rate,
            "delivery_date": delivery_date
        })

    so.insert()
    so.submit()

    pe_name = None
    if advance_amount > 0:
        paid_from = get_party_account("Customer", customer, company)
        paid_to = frappe.db.get_value(
                        "Mode of Payment Account",
                        {"parent": mode_of_payment, "company": company},
                        "default_account",
                )

        if not paid_to:
            frappe.throw(_("Could not find an account for Mode of Payment {0}. Please set a default account for it.").format(mode_of_payment))

        pe = frappe.new_doc("Payment Entry")
        pe.payment_type = "Receive"
        pe.company = company
        pe.party_type = "Customer"
        pe.party = customer
        pe.paid_from = paid_from
        pe.paid_to = paid_to
        pe.paid_from_account_currency = frappe.db.get_value("Account", paid_from, "account_currency")
        pe.paid_to_account_currency = frappe.db.get_value("Account", paid_to, "account_currency")
        pe.paid_amount = advance_amount
        pe.received_amount = advance_amount
        pe.mode_of_payment = mode_of_payment
        pe.reference_no = _("Advance for {0}").format(so.name)
        pe.reference_date = nowdate()
        pe.append("references", {
            "reference_doctype": "Sales Order",
            "reference_name": so.name,
            "allocated_amount": advance_amount
        })

        pe.insert()
        pe.submit()
        pe_name = pe.name

    return {"sales_order": so.name, "payment_entry": pe_name}
