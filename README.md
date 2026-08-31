## frappe_custom_app

Booking Order Automation for POS.

This app adds a "Booking Order" option to the Frappe/ERPNext Point of Sale screen for items that are out of stock. When enabled for a cart, the cashier can mark the sale as a booking, capture an optional advance payment, and the app creates a submitted Sales Order (and, if an advance was collected, a linked Payment Entry) directly from the POS.

### Features

- Adds a "Booking Order (Out of Stock)" checkbox and delivery date field to the POS cart.
- Creates a Sales Order for the cart items with the selected delivery date.
- Optionally records an advance payment against the Sales Order via a Payment Entry.
- Runs under the logged-in user's own permissions (no permission bypass).

### Installation

```
bench get-app frappe_custom_app <repo-url>
bench --site <site-name> install-app frappe_custom_app
```

### License

MIT
