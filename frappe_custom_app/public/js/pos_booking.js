frappe.pages['point-of-sale'].on_page_load = function () {
    setup_booking_feature();
};

function setup_booking_feature() {
    const observer = new MutationObserver(() => {
        inject_booking_checkbox();
        hijack_checkout_buttons();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    inject_booking_checkbox();
    hijack_checkout_buttons();
}

function inject_booking_checkbox() {
    const cartSection = document.querySelector('.abs-cart-container .cart-totals-section');
    if (!cartSection) return;
    if (document.getElementById('booking-checkbox-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'booking-checkbox-wrapper';
    wrapper.style = "padding:10px; display:flex; align-items:center; gap:8px; background:#fff3cd; color:#333; margin-bottom:8px; border-radius:4px;";
    wrapper.innerHTML = `
        <input type="checkbox" id="is_booking_chk">
        <label for="is_booking_chk" style="margin:0; font-weight:600;">Booking Order (Out of Stock)</label>
        <input type="date" id="booking_date" style="display:none; margin-left:auto;">
    `;
    cartSection.prepend(wrapper);

    document.getElementById('is_booking_chk').addEventListener('change', function () {
        document.getElementById('booking_date').style.display = this.checked ? 'inline-block' : 'none';
    });
}

function hijack_checkout_buttons() {
    document.querySelectorAll('.checkout-btn').forEach(btn => {
        if (btn.dataset.hijacked) return;
        btn.dataset.hijacked = "true";

        btn.addEventListener('click', function (e) {
            const chk = document.getElementById('is_booking_chk');
            if (!chk || !chk.checked) return;

            e.preventDefault();
            e.stopImmediatePropagation();

            const deliveryDate = document.getElementById('booking_date').value;
            if (!deliveryDate) {
                frappe.msgprint("Delivery Date daalain");
                return;
            }

            const doc = cur_pos.frm.doc;
            if (!doc.items || !doc.items.length) {
                frappe.msgprint("Cart khali hai");
                return;
            }
            if (!doc.customer) {
                frappe.msgprint("Customer select karein");
                return;
            }

            let d = new frappe.ui.Dialog({
                title: 'Booking - Advance Payment',
                fields: [
                    { fieldname: 'advance_amount', label: 'Advance Amount', fieldtype: 'Currency', default: 0 },
                    { fieldname: 'mode_of_payment', label: 'Mode of Payment', fieldtype: 'Link', options: 'Mode of Payment', default: 'Cash' }
                ],
                primary_action_label: 'Confirm Booking',
                primary_action(values) {
                    frappe.call({
                        method: "frappe_custom_app.api.create_booking_order",
                        args: {
                            customer: doc.customer,
                            items: doc.items.map(i => ({
                                item_code: i.item_code,
                                qty: i.qty,
                                rate: i.rate
                            })),
                            delivery_date: deliveryDate,
                            advance_amount: values.advance_amount,
                            mode_of_payment: values.mode_of_payment
                        },
                        freeze: true,
                        freeze_message: "Booking Order ban raha hai...",
                        callback: function (r) {
                            d.hide();
                            frappe.msgprint(`Booking Order <b>${r.message.sales_order}</b> ban gaya`);
                            setTimeout(() => location.reload(), 1500);
                        }
                    });
                }
            });
            d.show();
        }, true);
    });
}
