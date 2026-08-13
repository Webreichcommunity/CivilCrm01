export const formatCurrency = (value) => `INR ${Number(value || 0).toLocaleString('en-IN')}`;

export const normalizeProjectExpenseAllocations = (expense) => {
  const amount = Number(expense.amount || 0);

  if ((expense.payeeMode === 'multiple' || expense.allocationMode === 'single-site-multiple-payees') && Array.isArray(expense.payees)) {
    const projectId = expense.selectedProjectId || expense.projectId;
    if (!projectId) return [];

    return expense.payees
      .filter((payee) => Number(payee.amount || 0) > 0)
      .map((payee) => ({
        projectId,
        projectName: expense.selectedProjectName || expense.projectName || 'Unknown site',
        amount: Number(payee.amount || 0),
        paymentMode: payee.paymentMode || '',
        chequeNumber: payee.chequeNumber || '',
        chequeName: payee.chequeName || '',
        bankName: payee.bankName || '',
        chequeDate: payee.chequeDate || '',
        chequeIssuedTo: payee.chequeIssuedTo || '',
        payeeType: payee.payeeType || expense.payeeType || '',
        payeeName: payee.payeeName || expense.payeeName || '',
        expenseTitle: payee.expenseTitle || expense.expenseTitle || '',
        source: expense
      }));
  }

  if (expense.allocationMode === 'multiple' && Array.isArray(expense.allocations)) {
    return expense.allocations
      .filter((allocation) => allocation.projectId && Number(allocation.amount || 0) > 0)
      .map((allocation) => ({
        projectId: allocation.projectId,
        projectName: allocation.projectName || 'Unknown site',
        amount: Number(allocation.amount || 0),
        paymentMode: allocation.paymentMode || expense.paymentMode || '',
        chequeNumber: allocation.chequeNumber || '',
        chequeName: allocation.chequeName || '',
        bankName: allocation.bankName || '',
        chequeDate: allocation.chequeDate || '',
        chequeIssuedTo: allocation.chequeIssuedTo || '',
        payeeType: expense.payeeType || '',
        payeeName: expense.payeeName || '',
        expenseTitle: expense.expenseTitle || '',
        source: expense
      }));
  }

  const projectId = expense.selectedProjectId || expense.projectId;
  if (!projectId || amount <= 0) return [];

  return [{
    projectId,
    projectName: expense.selectedProjectName || expense.projectName || 'Unknown site',
    amount,
    paymentMode: expense.paymentMode || '',
    chequeNumber: expense.chequeNumber || '',
    chequeName: expense.chequeName || '',
    bankName: expense.bankName || '',
    chequeDate: expense.chequeDate || '',
    chequeIssuedTo: expense.chequeIssuedTo || '',
    payeeType: expense.payeeType || '',
    payeeName: expense.payeeName || '',
    expenseTitle: expense.expenseTitle || '',
    source: expense
  }];
};

export const getAllocatedExpenseTotalForProject = (expenses, projectId) =>
  expenses.reduce((total, expense) => {
    const projectAllocations = normalizeProjectExpenseAllocations(expense)
      .filter((allocation) => allocation.projectId === projectId);
    return total + projectAllocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  }, 0);

export const getAllocatedExpensesForProject = (expenses, projectId) =>
  expenses.flatMap((expense) =>
    normalizeProjectExpenseAllocations(expense)
      .filter((allocation) => allocation.projectId === projectId)
      .map((allocation) => ({
        ...expense,
        payeeType: allocation.payeeType || expense.payeeType,
        payeeName: allocation.payeeName || expense.payeeName,
        expenseTitle: allocation.expenseTitle || expense.expenseTitle,
        allocationAmount: allocation.amount,
        allocationPaymentMode: allocation.paymentMode,
        allocationProjectName: allocation.projectName,
        allocationChequeNumber: allocation.chequeNumber,
        allocationChequeName: allocation.chequeName,
        allocationBankName: allocation.bankName,
        allocationChequeDate: allocation.chequeDate,
        allocationChequeIssuedTo: allocation.chequeIssuedTo
      }))
  );
