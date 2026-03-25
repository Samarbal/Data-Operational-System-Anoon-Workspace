# 📡 API Reference - Booking Management & Time Handling

## Overview
All booking operations (create, update, delete) are handled through the existing `/api/process` endpoint. The timezone utilities provide consistent date/time handling across the system.

---

## 🌍 Timezone Utilities

### Import
```typescript
import * as TZ from '@/lib/timezone';
import type { SessionPayload } from '@/lib/auth';
```

### Available Functions

#### Date Operations
```typescript
// Get current date
TZ.getCurrentDate() → "25-03-2026"

// Format Date object
TZ.formatDate(new Date()) → "25-03-2026"

// Parse DD-MM-YYYY to Date
TZ.parseDate("25-03-2026") → Date object

// Compare two dates
TZ.compareDates("25-03-2026", "26-03-2026") → -1 (before)

// Get day name (Arabic)
TZ.getDayNameArabic(new Date()) → "الخميس"

// Get day from date string
TZ.getDayNameFromDateString("25-03-2026") → "الخميس"

// Add days
TZ.addDays("25-03-2026", 7) → "01-04-2026"

// Days remaining until date
TZ.getDaysRemaining("30-03-2026") → 5
```

#### Time Operations
```typescript
// Get current time
TZ.getCurrentTime() → "14:30:45"

// Format time
TZ.formatTime(new Date()) → "14:30:45"

// Parse time string
TZ.parseTime("14:30:45") → { hours: 14, minutes: 30, seconds: 45 }

// Calculate duration between times
TZ.calculateDuration("09:00", "11:30") → {
  label: "2س 30د",
  decimal: 2.5
}

// Calculate elapsed time since entry
TZ.calculateElapsedTime("25-03-2026", "09:00") → {
  label: "5س 30د",
  decimal: 5.5
}
```

#### Validation
```typescript
// Validate date format
TZ.isValidDateFormat("25-03-2026") → true

// Validate time format
TZ.isValidTimeFormat("14:30:45") → true

// Normalize time (add :00 if missing)
TZ.normalizeTimeFormat("14:30") → "14:30:00"
```

### Constants
```typescript
TZ.SYSTEM_TIMEZONE → "Asia/Jerusalem"
```

---

## 🛑 Booking Management API

### Endpoint
```
POST /api/process
```

### Authentication Required
✅ All requests must include valid session cookie  
✅ Social team can only edit/delete  
✅ Admin can do all operations  

### Create Booking
```json
{
  "action": "addBooking",
  "data": {
    "hall": "A",
    "name": "أحمد محمد",
    "phone": "0598000000",
    "date": "25-03-2026",
    "start": "10:00",
    "end": "12:00",
    "pipeline": "وسائل التواصل",
    "payType": "كاش",
    "revenue": 100,
    "amountPaid": 50,
    "chairs": "8",
    "notes": ""
  }
}
```

**Required Fields**: hall, name, phone, date, start, end  
**Optional Fields**: pipeline, payType, revenue, amountPaid, chairs, notes  

**Response Success**:
```json
{
  "success": true,
  "rowIndex": 42,
  "date": "25-03-2026",
  "duration": "2س"
}
```

**Response Error**:
```json
{
  "success": false,
  "error": "حقل القاعة مطلوب"
}
```

---

### Update Booking
```json
{
  "action": "updateRoom",
  "data": {
    "rowIndex": 42,
    "name": "محمد أحمد",
    "phone": "0597000000",
    "hall": "B",
    "date": "26-03-2026",
    "start": "14:00",
    "end": "16:00",
    "pipeline": "معرفة شخصية",
    "payType": "تحويل بنكي",
    "revenue": 150,
    "amountPaid": 150,
    "notes": "تم الدفع كاملاً"
  }
}
```

**Required Fields**: rowIndex  
**Optional Fields**: All booking fields (partial updates supported)  

**Response Success**:
```json
{
  "success": true
}
```

**Response Error**:
```json
{
  "success": false,
  "error": "رقم السطر مطلوب"
}
```

---

### Delete Booking
```json
{
  "action": "deleteBooking",
  "data": {
    "rowIndex": 42
  }
}
```

**Required Fields**: rowIndex  

**Response Success**:
```json
{
  "success": true
}
```

**Response Error**:
```json
{
  "success": false,
  "error": "السطر غير موجود"
}
```

---

## 💰 Payment Logic

### Paid Status Calculation
```
Payment Status = "نعم" (Yes) when:
  - Cost > 0 AND
  - Amount Remaining <= 0

Otherwise: "لا" (No)
```

### Example Calculations
```
Scenario 1: Full Payment
  Cost: 100
  Amount Paid: 100
  Remaining: 0
  Status: "نعم" ✓

Scenario 2: Partial Payment
  Cost: 100
  Amount Paid: 50
  Remaining: 50
  Status: "لا" ✓

Scenario 3: No Cost
  Cost: 0
  Amount Paid: 0
  Remaining: 0
  Status: "لا" ✓ (No charge)

Scenario 4: Overpayment
  Cost: 100
  Amount Paid: 150
  Remaining: 0 (max to 0)
  Status: "نعم" ✓
```

---

## 🔐 Access Control

### Role-Based Permissions
```typescript
// Admin
- View all bookings
- Create bookings
- Edit bookings
- Delete bookings
- Edit payments
- View archive

// Social Team
- View all bookings
- Create bookings ✓
- Edit bookings ✓
- Delete bookings ✓
- Edit payments ✗
- View archive ✗
```

### Permission Checks
```typescript
canAccessAction(role, action) → boolean

Examples:
canAccessAction("admin", "updateRoom")    → true
canAccessAction("social", "updateRoom")   → true
canAccessAction("social", "updatePayment")→ false
canAccessAction("admin", "anything")      → true
```

---

## 📊 Google Sheets Integration

### Auto-Sync Features
✅ All create operations auto-sync  
✅ All update operations auto-sync  
✅ All delete operations auto-sync  
✅ No manual sync required  
✅ Real-time updates  

### Sheet Mapping
```
حجز قاعات (Hall Bookings):
  Column A: ID
  Column B: Name
  Column C: Phone
  Column D: Room/Hall
  Column E: Pipeline
  Column F: Date
  Column G: Day
  Column H: Start Time
  Column I: End Time
  Column J: Duration
  Column K: Cost
  Column L: Pay Type
  Column M: Account
  Column N: Paid Status
  Column O: Notes
  Column P: Amount Paid
  Column Q: Amount Remaining
```

---

## 🧪 Testing Examples

### Create with cURL
```bash
curl -X POST http://localhost:3000/api/process \
  -H "Content-Type: application/json" \
  -b "space_noon_session=YOUR_TOKEN" \
  -d '{
    "action": "addBooking",
    "data": {
      "hall": "A",
      "name": "اختبار",
      "phone": "0598000000",
      "date": "25-03-2026",
      "start": "10:00",
      "end": "12:00"
    }
  }'
```

### Create with JavaScript
```javascript
async function createBooking() {
  const response = await fetch('/api/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'addBooking',
      data: {
        hall: 'A',
        name: 'اختبار',
        phone: '0598000000',
        date: '25-03-2026',
        start: '10:00',
        end: '12:00'
      }
    })
  });
  
  const result = await response.json();
  if (result.success) {
    console.log('Created:', result.rowIndex);
  } else {
    console.error('Error:', result.error);
  }
}
```

### Update with JavaScript
```javascript
async function updateBooking(rowIndex) {
  const response = await fetch('/api/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'updateRoom',
      data: {
        rowIndex: rowIndex,
        name: 'محمد',
        start: '14:00',
        end: '16:00'
      }
    })
  });
  
  const result = await response.json();
  if (result.success) {
    console.log('Updated');
  } else {
    console.error('Error:', result.error);
  }
}
```

---

## ⚠️ Error Codes

| Error | Meaning | Solution |
|-------|---------|----------|
| "حقل مطلوب" | Required field missing | Check all required fields |
| "صيغة غير صحيحة" | Invalid format | Check date (DD-MM-YYYY), time (HH:MM) |
| "رقم الهاتف غير صحيح" | Phone too short | Need at least 9 digits |
| "رقم السطر مطلوب" | No rowIndex provided | Include rowIndex in update/delete |
| "السطر غير موجود" | Row doesn't exist | Check correct rowIndex |
| "غير مصرح" | Not authenticated | Log in first |
| "محظور" | Permission denied | Check user role |

---

## 📝 Notes

- All dates must be DD-MM-YYYY format
- All times must be HH:MM format (or HH:MM:SS)
- Use `lib/timezone.ts` for date/time operations
- Payment status auto-calculated from amounts
- Never override calculated payment status
- All operations logged and synced automatically

---

Last Updated: March 25, 2026
