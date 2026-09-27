import React from 'react';
import { ArrowRight, CheckCircle2, Clock } from 'lucide-react';

export default function WorkflowTracker({ currentStep = 1 }) {
  const steps = [
    { num: 1, label: 'Customer Enquiry' },
    { num: 2, label: 'Quotation' },
    { num: 3, label: 'Sales Order' },
    { num: 4, label: 'Inventory Reservation' },
    { num: 5, label: 'Dispatch' },
  ];

  return (
    <div className="workflow-tracker">
      {steps.map((step, idx) => {
        const isCompleted = step.num < currentStep;
        const isActive = step.num === currentStep;
        let stepClass = 'workflow-step';
        if (isCompleted) stepClass += ' completed';
        if (isActive) stepClass += ' active';

        return (
          <React.Fragment key={step.num}>
            <div className={stepClass}>
              <div className="step-num">
                {isCompleted ? <CheckCircle2 size={16} /> : step.num}
              </div>
              <span>{step.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <span className="workflow-arrow">→</span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
