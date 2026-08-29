import frappe
from frappe.utils import flt, nowdate

@frappe.whitelist()
def create_booking_order(customer, items, delivery_date, advance_amount=0, mode_of_payment="Cash"):
    if isinstance(items, str):
        items = frappe.parse_json(items)

    so = frappe.new_doc("Sales Order")
    so.customer = customer
    so.delivery_date = delivery_date
    for item in items:
        so.append("items", {
            "item_code": item.get("item_code"),
            "qty": item.get("qty"),
            "rate": item.get("rate"),
            "delivery_date": delivery_date
        })
    so.insert(ignore_permissions=True)
    so.submit()

    pe_name = None
    if flt(advance_amount) > 0:
        pe = frappe.new_doc("Payment Entry")
        pe.payment_type = "Receive"
        pe.party_type = "Customer"
        pe.party = customer
        pe.paid_amount = advance_amount
        pe.received_amount = advance_amount
        pe.mode_of_payment = mode_of_payment
        pe.reference_no = so.name
        pe.reference_date = nowdate()
        pe.append("references", {
            "reference_doctype": "Sales Order",
            "reference_name": so.name,
            "allocated_amount": advance_amount
        })
        pe.insert(ignore_permissions=True)
        pe.submit()
        pe_name = pe.name

    frappe.db.commit()
    return {"sales_order": so.name, "payment_entry": pe_name}
