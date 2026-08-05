export const formatCurrency = (value) => `INR ${Number(value || 0).toLocaleString('en-IN')}`;

export const normalizeProjectExpenseAllocations = (expense) => {
  const amount = Number(expense.amount || 0);

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
        allocationAmount: allocation.amount,
        allocationPaymentMode: allocation.paymentMode,
        allocationProjectName: allocation.projectName,
        allocationChequeNumber: allocation.chequeNumber,
        allocationChequeName: allocation.chequeName,
        allocationBankName: allocation.bankName,
        allocationChequeDate: allocation.chequeDate
      }))
  );
