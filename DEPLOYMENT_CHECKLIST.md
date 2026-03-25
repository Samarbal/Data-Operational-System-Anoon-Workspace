# ✅ DEPLOYMENT VERIFICATION CHECKLIST

## Pre-Deployment (Immediate)

- [ ] **Review README_FIXES.md** - Understand all changes
- [ ] **Check QUICK_START.sh** - See quick reference
- [ ] **Verify timezone.ts exists** - lib/timezone.ts created
- [ ] **Verify auth.ts updated** - Social permissions added
- [ ] **Verify Code.gs.txt updated** - Payment logic fixed

## Deployment (During Testing)

### 1. Time Zone & Time Editing
- [ ] Clear browser cache (Ctrl+Shift+Delete)
- [ ] Login as Admin
- [ ] Check in a visitor
- [ ] Note the exact time shown
- [ ] Edit the visitor's entry time to a different value
- [ ] Click "Save"
- [ ] Refresh the page (F5)
- [ ] Time should be unchanged
- **✓ PASS** if time unchanged | **✗ FAIL** if time changed

### 2. Payment Status Logic
- [ ] Login as Admin
- [ ] Create a new booking:
  - Cost: 500
  - Amount Paid: 250
- [ ] Check the "مدفوع" (Paid) column
  - Should show: "لا" (No)
- [ ] Now update the same booking:
  - Amount Paid: 500
- [ ] Check the "مدفوع" column again
  - Should show: "نعم" (Yes)
- **✓ PASS** if both correct | **✗ FAIL** if incorrect

### 3. Visitor Archive
- [ ] Still logged in as Admin
- [ ] Check in at least 5 different visitors:
  - Use different names
  - Use different phone numbers
- [ ] Open Google Sheets directly
- [ ] Go to sheet "أرشيف الزبائن"
- [ ] Should see all 5 visitors listed
- [ ] Check their:
  - Name column
  - Phone column
  - Count should be 1 for each
- **✓ PASS** if all 5 appear | **✗ FAIL** if missing any

### 4. Multiple Visits (Archive)
- [ ] Check in same visitor twice on different days
- [ ] Go to archive sheet
- [ ] Same visitor row should still exist
- [ ] Count column should be 2
- [ ] Last visit date should be most recent
- **✓ PASS** if data correct | **✗ FAIL** if data wrong

### 5. Booking Edit (Social Team)
- [ ] Logout from Admin
- [ ] Login as social team user (e.g., "sara")
- [ ] Navigate to "حجز قاعات" (Hall Bookings)
- [ ] Find an existing booking
- [ ] Click "تعديل" (Edit) button
- [ ] Change:
  - Name: "اختبار" (Test)
  - Time Start: "15:00"
  - Time End: "17:00"
- [ ] Click "حفظ" (Save)
- [ ] Should see success message
- [ ] Open Google Sheets
- [ ] Check "حجز قاعات" sheet
- [ ] Verify changes appeared in sheet
- **✓ PASS** if changes saved | **✗ FAIL** if changes lost

### 6. Booking Delete (Social Team)
- [ ] Still logged as social user
- [ ] Find another booking
- [ ] Click "حذف" (Delete) button
- [ ] Confirm deletion
- [ ] Should see success message
- [ ] Open Google Sheets
- [ ] Check "حجز قاعات" sheet
- [ ] Booking should be gone
- **✓ PASS** if booking removed | **✗ FAIL** if still there

### 7. Permissions Check
- [ ] Try to delete with Admin login - should work
- [ ] Try to delete with Social login - should work
- [ ] Create a "test" user with no role
- [ ] Try actions with test user
- [ ] Should see "غير مصرح" (Unauthorized) error
- **✓ PASS** if permissions enforced | **✗ FAIL** if not

## Post-Deployment (Final Verification)

- [ ] All 7 tests passed
- [ ] No errors in browser console (F12)
- [ ] No errors in Google Apps Script logs
- [ ] Google Sheets data is current
- [ ] All Arabic text displays correctly
- [ ] No broken links or missing pages

## If Any Test Fails

### For Time Zone Issues
```
1. Check lib/timezone.ts exists
2. Clear browser cache completely
3. Try in private/incognito window
4. Check server timezone
5. Look for any browser extensions affecting dates
```

### For Payment Status Issues
```
1. Check Code.gs.txt was updated
2. Verify payCalc() is called with 'false'
3. Calculate manually: cost - paid = remaining
4. Payment should be 'نعم' only if remaining <= 0
5. Check for any formula-based overrides
```

### For Archive Issues
```
1. Check sheet "أرشيف الزبائن" exists
2. Verify service account has permissions
3. Check sheet name exact spelling (Arabic)
4. Run: verifyArchiveSystem() in Apps Script
5. Check Extensions > Apps Script > Executions for errors
```

### For Booking Edit/Delete Issues
```
1. Check user role is exactly "social"
2. Verify auth.ts has updateRoom in canAccessAction()
3. Check rowIndex is correct integer
4. Look for validation errors in API response
5. Try with Admin account (should work)
```

## Sign-Off

**Tester Name**: ___________________  
**Date**: ___________________  
**All Tests Passed**: Yes / No  
**Issues Found**: ___________________  
**Ready for Production**: Yes / No  

---

**Notes**:
- Color codes: ✓ = Pass, ✗ = Fail
- Test in this exact order
- Don't skip any tests
- If a test fails, note it and check troubleshooting
- Takes approximately 15-20 minutes total
