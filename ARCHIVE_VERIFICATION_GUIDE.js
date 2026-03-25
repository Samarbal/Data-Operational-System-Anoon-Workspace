/**
 * ════════════════════════════════════════════════════════════════
 * VISITOR ARCHIVE SYSTEM - VERIFICATION & TESTING GUIDE
 * ════════════════════════════════════════════════════════════════
 * 
 * SYSTEM OVERVIEW
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * The archive system has TWO stages:
 * 
 * STAGE 1: Queueing (In-Memory)
 *   Function: _upsertArchiveBatch(name, phone, pipeline, date)
 *   What it does: Adds visitor to pending queue
 *   Called from:
 *     - checkinVisitor()
 *     - addSubscription()
 *     - _authUpsertArchive() [Auth_Code.gs]
 * 
 * STAGE 2: Flushing (Write to Sheet)
 *   Function: _flushArchive()
 *   What it does: Writes all pending items to "أرشيف الزبائن" sheet
 *   Called from:
 *     - processRequest() in Auth_Code.gs [AFTER each action]
 *   
 *   IMPORTANT: This is called AFTER the action completes!
 * 
 * ════════════════════════════════════════════════════════════════
 * 
 * ISSUE ANALYSIS
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * REPORTED PROBLEM:
 * "Data not saving to visitor archive after adding entries"
 * 
 * COMMON CAUSES:
 * 
 * 1. Archive sheet doesn't exist
 *    Solution: getArchive() auto-creates, _flushArchive() writes
 * 
 * 2. _flushArchive() not called
 *    Verify: Check Auth_Code.gs processRequest() has flush call
 *    Status: ✓ CONFIRMED - Line: "if (typeof _flushArchive === 'function') _flushArchive();"
 * 
 * 3. Pending queue not populated
 *    Verify: Check _upsertArchiveBatch() is called in checkinVisitor()
 *    Status: ✓ CONFIRMED - Called in checkinVisitor()
 * 
 * 4. Sheet permissions issue
 *    Verify: Check Google Sheets permissions are correct
 *    Status: REQUIRES VERIFICATION
 * 
 * ════════════════════════════════════════════════════════════════
 * 
 * VERIFICATION STEPS
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * TEST 1: Check if archive sheet is being created
 *   Step 1: Open Admin Dashboard
 *   Step 2: Log into admin account
 *   Step 3: Open Google Sheet directly
 *   Expected: Sheet "أرشيف الزبائن" should exist with header row
 *   What to look for:
 *     - Sheet tabs at bottom
 *     - "أرشيف الزبائن" tab should be visible
 *     - Header row: (Name, Phone, First Visit, Last Visit, Count, Pipeline)
 * 
 * TEST 2: Check if data is being queued in memory
 *   Step 1: Admin login
 *   Step 2: Check in visitor
 *   Step 3: Check admin's browser console for logs
 *   What should happen:
 *     - _upsertArchiveBatch() called
 *     - Data added to _archivePending array
 * 
 * TEST 3: Check if _flushArchive() is being called
 *   Step 1: Admin login
 *   Step 2: Check in visitor at least once
 *   Step 3: Check Google Sheets for archive entry
 *   Expected result:
 *     - One row should appear in "أرشيف الزبائن" sheet
 *     - Row contains: Name, Phone, Today's Date, Today's Date, 1, Pipeline\n *   If we don't see data:
 *     - Check browser console (F12) for errors
 *     - Check processRequest logs
 * 
 * TEST 4: Multiple visits
 *   Step 1: Same visitor checks in multiple times on different days
 *   Step 2: Check archive sheet
 *   Expected:
 *     - Row count should increase to 2
 *     - Last visit date should update
 *     - Count should be 2
 * 
 * TEST 5: Same visitor, same day
 *   Step 1: Visitor checks in again same day
 *   Step 2: Check archive
 *   Expected:
 *     - Row count stays same
 *     - Last visit date stays same day
 *     - Count increases by 1
 * 
 * ════════════════════════════════════════════════════════════════
 * 
 * CODE FLOW VERIFICATION
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * USER ACTION: Visitor Check-in via Admin Dashboard
 *   ↓
 * checkinVisitor() called ✓
 *   ├─ Validates data
 *   ├─ Adds to visitors sheet
 *   ├─ Calls _upsertArchiveBatch(name, phone, pipeline, date) ✓
 *   └─ Returns success
 *   ↓
 * Admin dashboard updates UI ✓
 *   ↓
 * Frontend calls processRequest('checkin', {...}) ✓
 *   ↓
 * Backend Auth_Code.gs processRequest() called ✓
 *   ├─ Switches to case 'checkin'
 *   ├─ Calls checkinVisitor(data) ✓
 *   └─ At end: calls _flushArchive() ✓
 *   ↓
 * _flushArchive() executes ✓
 *   ├─ Checks if _archivePending is empty
 *   ├─ Gets existing archive rows
 *   ├─ Deduplicates by name || phone key
 *   ├─ Updates existing rows or adds new
 *   └─ Clears pending queue
 *   ↓
 * Archive sheet updated in Google Sheets ✓
 * 
 * ════════════════════════════════════════════════════════════════
 * 
 * IF ARCHIVE IS NOT WORKING:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 1. Check Google Sheets permissions
 *    - Service account email: Check in Google Console
 *    - Sheet shared with service account: Yes/No?
 *    - If no permission, add service account email to sheet
 * 
 * 2. Check sheet names are correct
 *    - Sheet name: 'أرشيف الزبائن' (exactly as shown)
 *    - Case: Arabic characters MUST match exactly
 *    - If wrong, update SHEET_NAMES.ARCHIVE constant
 * 
 * 3. Check Apps Script runtime
 *    - In lib/apps-script-runtime.ts
 *    - Verify _flushArchive is being called
 *    - Check cache invalidation works
 * 
 * 4. Enable debugging
 *    Add these lines to Code.gs.txt:
 *    
 *    function _flushArchive() {
 *      if (!_archivePending.length) {\n *        Logger.log('[ARCHIVE] No pending items to flush');\n *        return;\n *      }\n *      Logger.log('[ARCHIVE] Flushing ' + _archivePending.length + ' items');\n *      // ... rest of function\n *      Logger.log('[ARCHIVE] Flush complete');\n *    }\n * \n *    Then check logs in Google Apps Script editor:
 *    - Extensions > Apps Script > Executions
 * 
 * ════════════════════════════════════════════════════════════════
 */

// VERIFICATION SNIPPET - Add to Code.gs for debugging
function verifyArchiveSystem() {
  var s = sheet('أرشيف الزبائن');
  if (!s) {
    Logger.log('[ARCHIVE VERIFY] Sheet does not exist!');
    return false;
  }
  
  var lr = s.getLastRow();
  var lc = s.getLastColumn();
  Logger.log('[ARCHIVE VERIFY] Sheet exists with ' + (lr - 1) + ' data rows');
  
  var pending = typeof _archivePending !== 'undefined' ? _archivePending.length : 0;
  Logger.log('[ARCHIVE VERIFY] Pending items to flush: ' + pending);
  
  return {
    sheetExists: true,
    dataRows: lr - 1,
    pendingItems: pending,
    lastRow: lr,
    lastCol: lc
  };
}
