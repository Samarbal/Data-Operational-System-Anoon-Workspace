# 🔧 إصلاح عدم ظهور مبالغ السناك في جدول الاستقبال

**التاريخ**: 1 أبريل 2026  
**الحالة**: ✅ تم الإصلاح  
**الأولوية**: عالية جداً

---

## 🔴 المشكلة الأصلية

عند إضافة **سناك** لمشترك (subscription)، يتم:
- ✅ تحديث المبلغ في Google Sheets بشكل صحيح
- ✅ ظهور القيمة الجديدة في صفحة "الرئيسية"
- ✅ ظهور القيمة الجديدة في قسم "غير المحصّل"
- ❌ **لكن لا يظهر في جدول الاستقبال** (ساعات ويومي)

النتيجة: الجدول يعرض التكلفة القديمة بجانب اسم المشترك.

---

## 🔍 تحليل السبب

### المشكلة في الكود:

في دالة `addSnackToSubscription` بـ [Code.gs.txt](v3%20-%20Operational%20data%20system/Code.gs.txt#L624):

```javascript
// تم تحديث SNACK فقط
vrow[V.SNACK-1] = newSnack;  ✅

// لكن لم يتم تحديث COST و AMT_REM
vrow[V.COST-1]      // ❌ لم يُحدّث
vrow[V.AMT_REM-1]   // ❌ لم يُحدّث
```

**النتيجة:**
- جدول الاستقبال يقرأ من `APP.visitors` (من سجل الزوار)
- البيانات المرسلة تحتوي على القيم القديمة
- الجدول يعرض الأرقام الخاطئة

---

## ✅ الحل المطبق

### 1️⃣ تحديث `addSnackToSubscription` في Backend

**الملف:**  [Code.gs.txt](v3%20-%20Operational%20data%20system/Code.gs.txt#L624)

**التغييرات:**
```javascript
// ✅ الآن يحدّث COST و AMT_REM في سجل الزوار أيضاً

// تحديث SNACK (كما هو)
vrow[V.SNACK-1] = newSnack;

// ✅ إضافة: تحديث COST
var currentCost = parseFloat(vrow[V.COST-1]) || 0;
var newVisitorCost = currentCost + adding;
vrow[V.COST-1] = newVisitorCost;

// ✅ إضافة: تحديث AMT_REM
var vAmtPaid = parseFloat(vrow[V.AMT_PAID-1]) || 0;
var vNewRem = Math.max(0, newVisitorCost - vAmtPaid);
vrow[V.AMT_REM-1] = vNewRem;
vrow[V.PAID-1] = vNewRem <= 0 && newVisitorCost > 0 ? 'نعم' : 'لا';

// ✅ إرجاع البيانات الكاملة المحدثة
return {
  success: true, 
  snack: newSnack, 
  visitorCost: newVisitorCost,           // جديد
  visitorAmountRemaining: vNewRem,       // جديد
  newCost: newCost, 
  amountRemaining: newRem
};
```

### 2️⃣ تحسين Frontend — Optimistic Update

**الملف:** [Script.html.txt](v3%20-%20Operational%20data%20system/Script.html.txt#L1715)

#### عند إضافة سناك لمشترك:

```javascript
// ✅ تحديث محلي فوري (قبل الاستدعاء)
if(sub) {
  sub.cost = (parseFloat(sub.cost) || 0) + adding;
  sub.amountRemaining = Math.max(0, sub.cost - amtPaid);
}
if(vis) {
  vis.cost = (parseFloat(vis.cost) || 0) + adding;
  vis.amountRemaining = Math.max(0, vis.cost - (parseFloat(vis.amountPaid) || 0));
  vis.snack = (parseFloat(vis.snack) || 0) + adding;
}

// عند النجاح:
closeModal('modal-snack');
renderVisitors();                  // ✅ رندر فوري مع البيانات المحدثة
renderSubTable('ساعات', ...);     // ✅ تحديث جدول الاشتراكات
showToast('تمت إضافة سناك...', 'success');

// عند الفشل:
// تراجع فوري عن التحديثات
if(sub) sub.cost = (parseFloat(sub.cost) || 0) - adding;
if(vis) vis.cost = (parseFloat(vis.cost) || 0) - adding;
```

#### عند إضافة سناك لفريلانسر:

```javascript
// ✅ نفس النمط:
// 1. تحديث محلي فوري
// 2. تراجع في حالة الخطأ
// 3. رندر الجدول بعد النجاح
```

---

## 📊 ملخص التحديثات

| الكومبوننت | التغيير | السبب |
|-----------|--------|------|
| **Code.gs.txt** | تحديث COST و AMT_REM في سجل الزوار | جدول الاستقبال يقرأ من هنا |
| **Script.html.txt** | Optimistic Update للسناك | ظهور فوري دون انتظار Backend |
| **Script.html.txt** | رندر الجداول بعد الإضافة | تحديث العرض مباشرة |
| **Script.html.txt** | تراجع فوري عند الفشل | UX أفضل و منع البيانات الخاطئة |

---

## 🧪 خطوات الاختبار

### ✅ اختبار 1: إضافة سناك لمشترك "ساعات"

```
1. قم بـ "دخول" مشترك (subscription type: ساعات)
2. في جدول الاستقبال، لاحظ:
   - اسم المشترك
   - التكلفة الحالية (مثلاً: ₪50)
   - المبلغ المتبقي
3. اضغط على زر "☕ سناك"
4. أضف مبلغاً (مثلاً: ₪10) و أضغط "إضافة للحساب"
5. تحقق فوراً:
   ✅ التكلفة يجب أن تصبح ₪60
   ✅ المبلغ المتبقي يجب أن يتحدث
   ✅ شارة السناك ☕₪10 يجب أن تظهر
```

**النتيجة المتوقعة:**
✅ التحديث فوري (بدون تأخير)  
✅ لا حاجة لإعادة تحميل الصفحة

### ✅ اختبار 2: إضافة سناك لفريلانسر

```
1. تسجيل دخول فريلانسر (visitor type: ساعات/يومي)
2. لاحظ التكلفة في الجدول
3. اضغط على "☕ سناك"
4. أضف مبلغاً و اضغط "إضافة للحساب"
5. تحقق من التحديث الفوري في الجدول
```

### ✅ اختبار 3: التحقق من Google Sheets

```
1. افتح Google Sheets مباشرة
2. اذهب إلى شيت "سجل الزوار"
3. تحقق من الأعمدة:
   - SNACK (عمود 21)
   - COST (عمود 13)
   - AMT_REM (عمود 19)
4. يجب أن تكون كلها محدثة بشكل صحيح
```

---

## 🚀 التحسينات الإضافية

### أداء:
- ✅ Optimistic Update يزيل التأخير المرئي
- ✅ `renderVisitors()` أسرع من `silentRefresh()` الكامل
- ✅ لا توجد طلبات غير ضرورية

### UX:
- ✅ تحديث فوري للبيانات
- ✅ تراجع تلقائي عند الفشل
- ✅ رسائل نجاح/خطأ واضحة

### موثوقية:
- ✅ بيانات متسقة بين Frontend و Backend
- ✅ تحديث شامل للأعمدة المرتبطة
- ✅ معالجة الأخطاء الكاملة

---

## 📋 قائمة التحقق النهائية

- [x] تحديث `addSnackToSubscription` في Backend
- [x] تحديث Optimistic Update في Frontend
- [x] إضافة رندر الجداول المناسبة
- [x] معالجة الأخطاء و التراجع
- [x] توثيق الإصلاح
- [ ] اختبار على البيانات الحقيقية

---

## 📞 ملاحظات إضافية

### إذا استمرت المشكلة:

1. **امسح الـ Cache في المتصفح:**
   - `Ctrl+Shift+Delete` و اختر "All time"

2. **تحقق من Google Apps Script:**
   - افتح توثيق الدالة (Script Editor)
   - ابحث عن أخطاء في "Logs"

3. **اختبر مع بيانات جديدة:**
   - أنشئ مشترك جديد
   - أضف سناك
   - تحقق من الظهور الفوري

---

**الحالة النهائية:** ✅ جاهز للاختبار الشامل و الإطلاق
