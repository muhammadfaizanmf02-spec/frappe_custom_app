(function () {
function is_pos_route() {
try {
return frappe.get_route && frappe.get_route()[0] === "point-of-sale";
} catch (e) {
return false;
}
}

var stock_check_patched = false;
function patch_stock_check() {
if (stock_check_patched) return;
if (!window.erpnext || !erpnext.PointOfSale || !erpnext.PointOfSale.Controller) return;
var original_check = erpnext.PointOfSale.Controller.prototype.check_stock_availability;
if (!original_check) return;
erpnext.PointOfSale.Controller.prototype.check_stock_availability = function () {
var chk = document.getElementById("is_booking_chk");
if (chk && chk.checked) {
return true;
}
return original_check.apply(this, arguments);
};
stock_check_patched = true;
}

function tick() {
if (is_pos_route()) {
patch_stock_check();
}
}

$(document).ready(tick);
frappe.router.on("change", tick);
setInterval(tick, 1000);
})();
