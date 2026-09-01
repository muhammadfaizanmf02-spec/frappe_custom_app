(function () {
	function is_pos_route() {
		try {
			return frappe.get_route && frappe.get_route()[0] === "point-of-sale";
		} catch (e) {
			return false;
		}
	}

	function boot() {
		if (is_pos_route()) {
			setup_booking_feature();
		}
	}

	// Handle a hard refresh / direct load while already on the POS page.
	$(document).ready(boot);

	// frappe.pages['point-of-sale'] may not exist yet when this script runs
	// (POS is a Single Page App and the Page object is created lazily on first
	// visit), so relying on frappe.pages['point-of-sale'].on_page_load throws
	// and silently breaks the whole script. Listening to route changes instead
	// works regardless of load order and Frappe/ERPNext version.
	frappe.router.on("change", boot);
})();

let booking_observer_started = false;

function setup_booking_feature() {
	inject_booking_checkbox();
	hijack_checkout_buttons();

	if (!booking_observer_started) {
		booking_observer_started = true;
		const observer = new MutationObserver(() => {
			inject_booking_checkbox();
			hijack_checkout_buttons();
		});
		observer.observe(document.body, { childList: true, subtree: true });
	}
}

function inject_booking_checkbox() {
	const cartSection = document.querySelector(".abs-cart-container .cart-totals-section");
	if (!cartSection) return;
	if (document.getElementById("booking-checkbox-wrapper")) return;

	const wrapper = document.createElement("div");
	wrapper.id = "booking-checkbox-wrapper";
	wrapper.style = "padding:10px; display:flex; align-items:center; gap:8px; background:#fff3cd; color:#333; margin-bottom:8px; border-radius:4px;";
	wrapper.innerHTML = `
		<input type="checkbox" id="is_booking_chk">
		<label for="is_booking_chk" style="margin:0; font-weight:600;">Booking Order (Out of Stock)</label>
		<input type="date" id="booking_date" style="display:none; margin-left:auto;">
	`;
	cartSection.prepend(wrapper);

	document.getElementById("is_booking_chk").addEventListener("change", function () {
		document.getElementById("booking_date").style.display = this.checked ? "inline-block" : "none";
	});
}

function hijack_checkout_buttons() {
	document.querySelectorAll(".checkout-btn").forEach(btn => {
		if (btn.dataset.hijacked) return;
		btn.dataset.hijacked = "true";

		btn.addEventListener("click", function (e) {
			const chk = document.getElementById("is_booking_chk");
			if (!chk || !chk.checked) return;

			e.preventDefault();
			e.stopImmediatePropagation();

			const deliveryDate = document.getElementById("booking_date").value;
			if (!deliveryDate) {
				frappe.msgprint("Please enter a Delivery Date");
				return;
			}

			const doc = cur_pos.frm.doc;
			if (!doc.items || !doc.items.length) {
				frappe.msgprint("Cart is empty");
				return;
			}
			if (!doc.customer) {
				frappe.msgprint("Please select a Customer");
				return;
			}

			let dialog = new frappe.ui.Dialog({
				title: "Booking - Advance Payment",
				fields: [
					{ fieldname: "advance_amount", label: "Advance Amount", fieldtype: "Currency", default: 0 },
					{ fieldname: "mode_of_payment", label: "Mode of Payment", fieldtype: "Link", options: "Mode of Payment", default: "Cash" }
				],
				primary_action_label: "Confirm Booking",
				primary_action(values) {
					const $primary_btn = dialog.get_primary_btn();

					frappe.call({
						method: "frappe_custom_app.api.create_booking_order",
						args: {
							customer: doc.customer,
							company: doc.company,
							items: doc.items.map(i => ({
								item_code: i.item_code,
								qty: i.qty,
								rate: i.rate
							})),
							delivery_date: deliveryDate,
							advance_amount: values.advance_amount,
							mode_of_payment: values.mode_of_payment
						},
						// disables the button for the duration of the call and
						// re-enables it automatically on error, preventing double
						// submits from a slow network or an eager double-click
						btn: $primary_btn,
						freeze: true,
						freeze_message: "Booking Order is being created...",
						callback: function (r) {
							dialog.hide();
							frappe.msgprint(`Booking Order <b>${r.message.sales_order}</b> created successfully`);
							setTimeout(() => location.reload(), 1500);
						}
					});
				}
			});

			dialog.show();
		});
	});
}
