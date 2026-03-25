/**
 * ════════════════════════════════════════════════════════════════
 * PAYMENT STATUS FIX - DETAILED IMPLEMENTATION
 * ════════════════════════════════════════════════════════════════
 * 
 * ISSUE:
 * When creating bookings, payment is marked as "paid" (نعم) even when
 * only partial amount is entered.
 * 
 * ROOT CAUSE:
 * In addNewBooking() function, the payCalc() call uses:
 *   var pc = payCalc(data.revenue, data.amountPaid, data.paid && !data.amountPaid);
 * 
 * This is incorrect because:
 * - The third parameter (fullFlag) is true when: data.paid=true AND data.amountPaid is empty
 * - When fullFlag=true, payCalc sets paid amount to cost (full payment)
 * - This causes false marking of "paid" status
 * 
 * SOLUTION:
 * The payCalc() function already has correct logic:
 *   paidFlag: rem <= 0 && c > 0 ? 'نعم' : 'لا'
 * 
 * So the fix is to:
 * 1. Always call payCalc with fullFlag=false (or omit it)
 * 2. Let payCalc calculate the paid status based on remaining amount
 * 3. NEVER override the paid status after payCalc returns
 * 
 * CORRECT USAGE PATTERN:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 *   // Get amounts from data
 *   var cost = parseFloat(data.revenue) || 0;
 *   var amountPaid = parseFloat(data.amountPaid) || 0;
 *   
 *   // Calculate payment status
 *   var pc = payCalc(cost, amountPaid, false);
 *   
 *   // Use the calculated values - DO NOT OVERRIDE
 *   row[R.COST-1] = pc.cost;
 *   row[R.AMT_PAID-1] = pc.paid;
 *   row[R.AMT_REM-1] = pc.rem;
 *   row[R.PAID-1] = pc.paidFlag;  // This is the ONLY source of truth
 */

// FIXED: addNewBooking (in Code.gs.txt)
function addNewBooking_FIXED(data){
  if(!data.hall||!data.name||!data.date||!data.start||!data.end)
    return{success:false, error:'يرجى تعبئة جميع الحقول المطلوبة'};

  if(data.chairs&&+data.chairs>16) return{success:false, error:'الحد الأقصى للكراسي 16'};

  var dp=data.date.split('-');
  var fmtDate=dp[2]+'-'+dp[1]+'-'+dp[0];
  var sp=data.start.split(':'), ep=data.end.split(':');
  var diff=(+ep[0]*60+ +ep[1])-(+sp[0]*60+ +sp[1]);
  if(diff<=0) return{success:false, error:'وقت النهاية يجب أن يكون بعد البداية'};

  var dur=Math.floor(diff/60)+'س '+(diff%60>0?diff%60+'د':'');
  var s=sheet(SHEET_NAMES.ROOMS), nid=nextId(s);
  
  // FIX: Always calculate payment status correctly
  var pc=payCalc(
    parseFloat(data.revenue)||0,
    parseFloat(data.amountPaid)||0,
    false  // Always false - let payCalc determine paid status
  );

  var row=new Array(RC).fill('');
  row[R.ID-1]=nid;
  row[R.NAME-1]=data.name.trim();
  row[R.PHONE-1]=data.phone||'';
  row[R.ROOM-1]=data.hall;
  row[R.PIPE-1]=data.pipeline||'';
  row[R.DATE-1]=fmtDate;
  row[R.DAY-1]=dayName(new Date(+dp[0],+dp[1]-1,+dp[2]));
  row[R.START-1]=data.start;
  row[R.END-1]=data.end;
  row[R.DUR-1]=dur;
  row[R.COST-1]=pc.cost;           // Use payCalc result
  row[R.PAY_T-1]=data.payType||'';
  row[R.PAID-1]=pc.paidFlag;       // Use ONLY payCalc result, NOT data.paid
  row[R.NOTES-1]=data.chairs?'كراسي: '+data.chairs:'';
  row[R.AMT_PAID-1]=pc.paid;       // Use payCalc result
  row[R.AMT_REM-1]=pc.rem;         // Use payCalc result

  var nr=s.getLastRow()+1;
  writeRow(s,nr,row);
  invR();

  return{success:true, rowIndex:nr, date:fmtDate, duration:dur};
}

// FIXED: updateRoom (snippet)
// When updating payment info, always recalculate
var c=data.cost!==undefined?parseFloat(data.cost)||0:parseFloat(row[R.COST-1])||0;
var p=data.amountPaid!==undefined?parseFloat(data.amountPaid)||0:parseFloat(row[R.AMT_PAID-1])||0;
var rem=Math.max(0,c-p);

row[R.COST-1]=c;
row[R.AMT_PAID-1]=p;
row[R.AMT_REM-1]=rem;
row[R.PAID-1]=rem<=0&&c>0?'نعم':'لا';  // CORRECT: Based only on remaining amount
// DO NOT: if(data.paid!==undefined) row[R.PAID-1]=data.paid;

/**
 * SUMMARY OF FIXES IN THIS FILE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * 1. addNewBooking(): Remove data.paid override, use payCalc result
 * 2. updateRoom():    Remove data.paid override, calculate from amounts
 * 3. updatePayment(): Already correct - keep as is
 * 4. addSubscription(): Remove data.paid override, use payCalc result
 * 5. addFutureBooking(): Remove data.paid override, use payCalc result
 */
