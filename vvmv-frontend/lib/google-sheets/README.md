# Google Sheets Integration

This module provides server-side integration with Google Sheets using service account authentication.

## Features

- ✅ Read-only access to Google Sheets
- ✅ Service account authentication (no OAuth flow needed)
- ✅ Server-side only (credentials never exposed to client)
- ✅ Fresh data on every page load
- ✅ TypeScript support with full type safety
- ✅ Error handling with custom error types

## Setup

### 1. Install Dependencies

Already installed: `googleapis@165.0.0`

### 2. Environment Variables

Required variables in `.env`:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=your-sheet-id-from-url
```

**Getting these values:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project
3. Enable Google Sheets API
4. Create a Service Account
5. Generate a JSON key file
6. Copy `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
7. Copy `private_key` → `GOOGLE_PRIVATE_KEY`
8. Get Sheet ID from your Google Sheets URL:
   ```
   https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit
   ```

### 3. Share Your Sheet

**IMPORTANT:** Share your Google Sheet with the service account email (read-only access).

1. Open your Google Sheet
2. Click "Share" button
3. Add the service account email (from `GOOGLE_SERVICE_ACCOUNT_EMAIL`)
4. Set permission to "Viewer"

## Usage

### Basic Example

```typescript
import { getOrderTrackingData } from '@/lib/google-sheets';

// Fetch order data by order code
const data = await getOrderTrackingData('VT1827980931');

if (data) {
  console.log('Order:', data.order);
  console.log('History:', data.history);
}
```

### Fetch All Orders

```typescript
import { getAllOrders } from '@/lib/google-sheets';

const orders = await getAllOrders();
```

### Test Connection

```typescript
import { testConnection } from '@/lib/google-sheets';

const result = await testConnection();
console.log(result.message);
```

## Customizing Sheet Structure

The default implementation expects two sheets:

1. **Orders Sheet** - Main order data
2. **History Sheet** - Order status history

### Configure Sheet Names and Ranges

In `lib/google-sheets/service.ts`, update these default values:

```typescript
// Change sheet names and ranges
const ordersRange = "Orders!A:R";  // Your sheet name and columns
const historyRange = "History!A:D"; // Your history sheet
```

### Configure Column Mapping

If your sheet has different column order, update `DEFAULT_COLUMN_MAPPING` in `service.ts`:

```typescript
const DEFAULT_COLUMN_MAPPING: SheetColumnMapping = {
  orderCode: 0,      // Column A = index 0
  status: 1,         // Column B = index 1
  sender: 2,         // Column C = index 2
  // ... customize based on your sheet structure
};
```

**Example:** If your sheet has:
- Column A: Status
- Column B: Order Code
- Column C: Weight

Then set:
```typescript
{
  orderCode: 1,  // Order Code is in column B (index 1)
  status: 0,     // Status is in column A (index 0)
  weight: 2,     // Weight is in column C (index 2)
  // ...
}
```

## Sheet Structure Requirements

### Orders Sheet

Expected columns (customize via column mapping):

| Column | Field | Type | Example |
|--------|-------|------|---------|
| A | Order Code | string | VT1827980931 |
| B | Status | string | Giao thành công |
| C | Sender | string | dần |
| D | Delivery Status | string | Giao thành công |
| E | Province | string | Long An |
| F | District | string | Hải Phòng |
| G | Weight | number | 346 |
| H | Packages | number | 133 |
| ... | ... | ... | ... |

### History Sheet

Expected columns:

| Column | Field | Type | Example |
|--------|-------|------|---------|
| A | Order Code | string | VT1827980931 |
| B | Time | string | 30-08-2025 07:16 |
| C | Office | string | BƯU CỤC LONG HẬU |
| D | Status | string | Đã nhận tại bưu cục gửi |
| E | Note | string | Đã lấy hàng |

## Error Handling

The module throws `GoogleSheetsError` with specific error codes:

```typescript
import { GoogleSheetsError } from '@/lib/google-sheets';

try {
  const data = await getOrderTrackingData(orderCode);
} catch (error) {
  if (error instanceof GoogleSheetsError) {
    console.error('Google Sheets Error:', error.message);
    console.error('Error Code:', error.code);
  }
}
```

## Implementation in External Page

The external order tracking page (`app/(home)/external/page.tsx`) uses:

1. **Server Component** - Fetches data server-side on every request
2. **URL Search Params** - Order code passed via `?orderCode=...`
3. **Client Components** - Interactive UI (search form, copy button)

**Flow:**
```
User enters order code → Form submits → Page reloads with ?orderCode=...
→ Server fetches from Google Sheets → Renders with fresh data
```

## Troubleshooting

### "Missing required environment variables"

- Check `.env` file has all three variables
- Restart dev server after changing `.env`

### "Failed to fetch data from Google Sheets"

- Verify service account has access to the sheet (shared with service account email)
- Check `GOOGLE_SHEET_ID` is correct
- Verify sheet names in range (e.g., "Orders!A:R" matches your sheet name)

### "No data found in the specified range"

- Check sheet name in range parameter
- Verify the sheet has data
- Check column range (A:R) includes all needed columns

### "Invalid credentials"

- Verify `GOOGLE_PRIVATE_KEY` has proper line breaks (`\n`)
- Check the key includes `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
- Ensure no extra quotes or escaping in `.env`

## Performance Considerations

**Current Implementation:**
- Direct fetching on every page load
- No caching or database sync
- Suitable for:
  - Small to medium datasets (<1000 rows)
  - Infrequent page loads
  - Always-fresh data requirements

**If You Need Better Performance:**

Consider adding caching or database sync:

```typescript
// Option 1: Add React Cache
import { cache } from 'react';

export const getCachedOrderData = cache(async (orderCode: string) => {
  return await getOrderTrackingData(orderCode);
});

// Option 2: Sync to Prisma Database
// Create a cron job to periodically sync Google Sheets → Prisma
// Then query from database instead of Sheets
```

## API Reference

### Functions

#### `getOrderTrackingData(orderCode, ordersRange?, historyRange?, columnMapping?)`

Fetch order and history data by order code.

**Returns:** `Promise<OrderTrackingData | null>`

#### `getAllOrders(range?, columnMapping?)`

Fetch all orders from the sheet.

**Returns:** `Promise<OrderInfo[]>`

#### `fetchSheetData(range)`

Low-level function to fetch raw sheet data.

**Returns:** `Promise<SheetRow[]>`

#### `testConnection()`

Test Google Sheets API connection.

**Returns:** `Promise<{ success: boolean, message: string }>`

## Next Steps

1. **Configure your sheet structure** - Update column mapping in `service.ts`
2. **Test the connection** - Use `testConnection()` to verify setup
3. **Customize the UI** - Modify components in `app/(home)/external/_components/`
4. **Add more features**:
   - Search by customer name
   - Filter by status
   - Export to PDF/Excel
   - Email notifications

## Support

For Google Sheets API documentation:
- [Google Sheets API Reference](https://developers.google.com/sheets/api/reference/rest)
- [Service Account Authentication](https://cloud.google.com/iam/docs/service-accounts)
