import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

const mapDataByType = (data, type, itemNames) => {
  if (type === 'material') {
    return data.map((entry) => {
      const itemName = itemNames?.find((item) => item.id === entry.itemName)?.name || 'Unknown';
      const itemMaster = itemNames?.find((item) => item.id === entry.itemName);
      return {
        Category: entry.categoryName || itemMaster?.categoryName || '',
        'Sub Category': entry.subCategoryName || itemMaster?.subCategoryName || '',
        'Item Name': itemName,
        'Date & Time': new Date(entry.dateTime).toLocaleString('en-IN'),
        'Vendor Name': entry.vendorName || '',
        Unit: entry.unit || '',
        Quantity: Number(entry.quantity || 0),
        'Per Item Price (INR)': Number(entry.perItemPrice || 0),
        'Amount (INR)': Number(entry.finalAmount || 0),
        'Payment Mode': entry.paymentMode || '',
        'Cheque Number': entry.chequeNumber || '',
        'Cheque Name': entry.chequeName || '',
        'Bank Name': entry.bankName || '',
        'Cheque Date': entry.chequeDate || '',
        Note: entry.note || ''
      };
    });
  }

  if (type === 'labour') {
    return data.map((entry) => ({
      Date: new Date(entry.date).toLocaleString('en-IN'),
      'Contractor Name': entry.contractorName || '',
      'Mode of Work': entry.modeOfWork || '',
      'Contact Number': entry.contactNumber || '',
      'Amount (INR)': Number(entry.amount || 0),
      'Payment Mode': entry.paymentMode || '',
      Category: entry.categoryName || '',
      'Cheque Number': entry.chequeNumber || '',
      'Cheque Name': entry.chequeName || '',
      'Bank Name': entry.bankName || '',
      'Cheque Date': entry.chequeDate || '',
      Note: entry.note || ''
    }));
  }

  if (type === 'payment') {
    return data.map((entry) => ({
      'Date & Time': new Date(entry.dateTime).toLocaleString('en-IN'),
      'Amount (INR)': Number(entry.amount || 0),
      'Payment Mode': entry.paymentMode || '',
      'Cheque Number': entry.chequeNumber || '',
      'Cheque Name': entry.chequeName || '',
      'Bank Name': entry.bankName || '',
      'Cheque Date': entry.chequeDate || '',
      'Payment Type': entry.paymentType === 'in' ? 'Payment In' : 'Payment Out',
      Note: entry.note || ''
    }));
  }

  if (type === 'expense') {
    return data.map((entry) => {
      const allocations = entry.allocations?.length
        ? entry.allocations.map((allocation) => {
          const cheque = allocation.paymentMode === 'cheque'
            ? `, Cheque: ${allocation.chequeNumber || '-'}, ${allocation.chequeName || '-'}, ${allocation.bankName || '-'}, ${allocation.chequeDate || '-'}`
            : '';
          return `${allocation.projectName || 'Site'}: INR ${Number(allocation.amount || 0).toLocaleString('en-IN')} (${allocation.paymentMode || '-'})${cheque}`;
        }).join(' | ')
        : '';

      return {
        'Date & Time': new Date(entry.dateTime).toLocaleString('en-IN'),
        'Payee Type': entry.payeeType || '',
        'Payee Name': entry.payeeName || '',
        'Expense Title': entry.expenseTitle || '',
        'Amount (INR)': Number(entry.amount || 0),
        'Payment Mode': entry.paymentMode || (entry.allocationMode === 'multiple' ? 'Site-wise' : ''),
        'Site Allocations': allocations,
        'Cheque Number': entry.chequeNumber || '',
        'Cheque Name': entry.chequeName || '',
        'Bank Name': entry.bankName || '',
        'Cheque Date': entry.chequeDate || '',
        Note: entry.note || ''
      };
    });
  }

  return data;
};

const exportToExcel = (rows, filename) => {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');
  XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

const exportToPdf = (rows, filename) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const marginX = 36;
  const marginY = 42;
  const pageWidth = doc.internal.pageSize.getWidth() - marginX * 2;

  doc.setFontSize(14);
  doc.text('Export Report', marginX, marginY);
  doc.setFontSize(9);

  let cursorY = marginY + 22;
  rows.forEach((row, rowIndex) => {
    const rowText = Object.entries(row)
      .map(([key, value]) => `${key}: ${value ?? ''}`)
      .join(' | ');

    const lines = doc.splitTextToSize(rowText, pageWidth);
    lines.forEach((line) => {
      if (cursorY > doc.internal.pageSize.getHeight() - 36) {
        doc.addPage();
        cursorY = marginY;
      }
      doc.text(line, marginX, cursorY);
      cursorY += 12;
    });

    cursorY += rowIndex === rows.length - 1 ? 0 : 8;
  });

  doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
};

const ExportButton = ({ data, filename, type, itemNames }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const exportRows = useMemo(() => mapDataByType(data, type, itemNames), [data, type, itemNames]);

  const onSelectFormat = (format) => {
    if (format === 'excel') {
      exportToExcel(exportRows, filename);
    } else {
      exportToPdf(exportRows, filename);
    }
    setIsModalOpen(false);
  };

  return (
    <>
      <button type="button" onClick={() => setIsModalOpen(true)} disabled={!data.length} className="orange-btn h-[42px] whitespace-nowrap">
        <Download className="h-4 w-4" />
        Export
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="glass-card w-full max-w-md">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Export Data</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="neutral-btn h-9 w-9 border-none p-0 text-slate-500 hover:text-blue-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 px-5 py-5">
              <button type="button" onClick={() => onSelectFormat('excel')} className="w-full justify-start rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-700 shadow-sm transition hover:bg-blue-100 flex items-center gap-3">
                <FileSpreadsheet className="h-4 w-4 text-blue-700" />
                Export as Excel (.xlsx)
              </button>
              <button type="button" onClick={() => onSelectFormat('pdf')} className="w-full justify-start rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-700 shadow-sm transition hover:bg-blue-100 flex items-center gap-3">
                <FileText className="h-4 w-4 text-blue-700" />
                Export as PDF (.pdf)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ExportButton;

