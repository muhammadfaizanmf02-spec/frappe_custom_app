frappe.pages['point-of-sale'].on_page_load = function(wrapper) {
    setTimeout(() => { inject_booking_ui(); }, 2000);
};

function inject_booking_ui() {
    if (document.getElementById('booking-checkbox-wrapper')) return;
    const cart = document.querySelector('.pos-bill') || document.querySelector('.item-cart');
    if (!cart) { setTimeout(inject_booking_ui, 1000); return; }

    const wrapper = document.createElement('div');
    wrapper.id = 'booking-checkbox-wrapper';
    wrapper.style = "padding:10px; display:flex; align-items:center; gap:8px; background:#fff3cd;";
    wrapper.innerHTML = `
        <input type="checkbox" id="is_booking_chk">
        <label for="is_booking_chk" style="margin:0; font-weight:600;">Booking Order (Out of Stock)</label>
        <input type="date" id="booking_date" style="display:none;">
    `;
    cart.prepend(wrapper);

    document.getElementById('is_booking_chk').addEventListener('change', function() {
        document.getElementById('booking_date').style.display = this.checked ? 'inline-block' : 'none';
    });

    hijack_checkout();
}

function hijack_checkout() {
    setInterval(() => {
        const btn = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Checkout' || b.innerText.trim() === 'Pay');
        if (btn && !btn.dataset.hijacked) {
            btn.dataset.hijacked = "true";
            btn.addEventListener('click', function(e) {
                const isBooking = document.getElementById('is_booking_chk')?.checked;
                if (isBooking) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    const deliveryDate = document.getElementById('booking_date').value;
                    if (!deliveryDate) { frappe.msgprint("Delivery Date daalain"); return; }

                    let d = new frappe.ui.Dialog({
                        title: 'Advance Payment',
                        fields: [
                            {fieldname: 'advance_amount', label: 'Advance Amount', fieldtype: 'Currency'},
                            {fieldname: 'mode_of_payment', label: 'Mode of Payment', fieldtype: 'Link', options: 'Mode of Payment', default: 'Cash'}
                        ],
                        primary_action_label: 'Confirm Booking',
                        primary_action(values) {
                            let customer = cur_pos.frm.doc.customer;
                            let cur_items = cur_pos.get_items ? cur_pos.get_items() : cur_pos.items;
                            frappe.call({
                                method: "frappe_custom_app.api.create_booking_order",
                                args: {
                                    customer: customer,
                                    items: cur_items,
                                    delivery_date: deliveryDate,
                                    advance_amount: values.advance_amount,
                                    mode_of_payment: values.mode_of_payment
                                },
                                callback: function(r) {
                                    frappe.msgprint(`Booking Order: ${r.message.sales_order} ban gaya`);
                                    d.hide();
                                    cur_pos.clear_cart && cur_pos.clear_cart();
                                    document.getElementById('is_booking_chk').checked = false;
                                }
                            });
                        }
                    });
                    d.show();
                }
            }, true);
        }
    }, 1500);
}
