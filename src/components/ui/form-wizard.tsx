"use client";

import { useState, type ReactNode, useCallback } from "react";
import { cn } from "@/lib/cn";
import { Stepper, Step, StepperActions, StepContent } from "./stepper";
import { Button } from "./button";

export interface WizardStep {
  key: string;
  label: string;
  description?: string;
  icon?: string; // IconName from icon.tsx
  disabled?: boolean;
  optional?: boolean;
  /** Hàm validate cho step này, trả về error message hoặc undefined nếu valid */
  validate?: (data: Record<string, unknown>) => string | undefined;
}

export interface FormWizardProps {
  /** Các bước của wizard */
  steps: WizardStep[];
  /** Render nội dung từng bước */
  children: (props: { currentStep: number; goToStep: (index: number) => void; data: Record<string, unknown>; setField: (key: string, value: unknown) => void }) => ReactNode;
  /** Callback khi hoàn tất wizard */
  onComplete: (data: Record<string, unknown>) => void | Promise<void>;
  /** Callback khi hủy */
  onCancel?: () => void;
  /** Bước khởi đầu */
  initialStep?: number;
  /** Dữ liệu khởi tạo */
  initialData?: Record<string, unknown>;
  /** Cho phép click vào stepper để chuyển bước */
  clickableSteps?: boolean;
  /** Hiển thị theo chiều dọc */
  vertical?: boolean;
  /** Class thêm */
  className?: string;
  /** Text nút hoàn tất */
  completeLabel?: string;
}

/**
 * FormWizard - Multi-step form với validation, navigation, state management
 * Usage:
 * <FormWizard
 *   steps={[{ key: 'step1', label: 'Bước 1' }, { key: 'step2', label: 'Bước 2' }]}
 *   onComplete={handleComplete}
 * >
 *   {({ currentStep, goToStep, data, setField }) => (
 *     <>
 *       <StepContent stepKey="step1" currentStep={currentStep} steps={steps}>
 *         <input value={data.field1} onChange={e => setField('field1', e.target.value)} />
 *       </StepContent>
 *       <StepContent stepKey="step2" currentStep={currentStep} steps={steps}>
 *         <select value={data.field2} onChange={e => setField('field2', e.target.value)}>...</select>
 *       </StepContent>
 *     </>
 *   )}
 * </FormWizard>
 */
export function FormWizard({
  steps,
  children,
  onComplete,
  onCancel,
  initialStep = 0,
  initialData = {},
  clickableSteps = false,
  vertical = false,
  className,
  completeLabel = "Hoàn tất",
}: FormWizardProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [data, setData] = useState<Record<string, unknown>>(initialData);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const goToStep = useCallback((index: number) => {
    if (index < 0 || index >= steps.length) return;
    if (steps[index].disabled) return;
    setCurrentStep(index);
  }, [steps]);

  const setField = useCallback((key: string, value: unknown) => {
    setData((prev) => ({ ...prev, [key]: value }));
    // Clear error khi user sửa
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }, [errors]);

  const validateStep = (stepIndex: number): boolean => {
    const step = steps[stepIndex];
    if (!step.validate) return true;

    const error = step.validate(data);
    if (error) {
      setErrors((prev) => ({ ...prev, [step.key]: error }));
      return false;
    }
    setErrors((prev) => {
      const next = { ...prev };
      delete next[step.key];
      return next;
    });
    return true;
  };

  const handleNext = async () => {
    if (!validateStep(currentStep)) return;

    if (currentStep < steps.length - 1) {
      goToStep(currentStep + 1);
    } else {
      await handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    // Validate tất cả các bước trước khi complete
    for (let i = 0; i < steps.length; i++) {
      if (!validateStep(i)) {
        goToStep(i);
        return;
      }
    }

    setLoading(true);
    try {
      await onComplete(data);
    } finally {
      setLoading(false);
    }
  };

  const handleStepClick = (index: number) => {
    // Chỉ cho phép click vào các bước đã hoàn thành hoặc hiện tại
    if (index <= currentStep) {
      goToStep(index);
    }
  };

  const stepKeys = steps.map((s) => s.key);
  const canGoNext = currentStep < steps.length - 1;
  const isLastStep = currentStep === steps.length - 1;
  const currentStepError = steps[currentStep].validate ? errors[steps[currentStep].key] : undefined;

  return (
    <div className={cn("w-full", className)}>
      {/* Stepper Header */}
      <Stepper
        steps={steps.map((s) => ({
          key: s.key,
          label: s.label,
          description: s.description,
          icon: s.icon as any,
          disabled: s.disabled,
          optional: s.optional,
        }))}
        currentStep={currentStep}
        onStepClick={clickableSteps ? handleStepClick : undefined}
        clickable={clickableSteps}
        vertical={vertical}
      />

      {/* Step Content */}
      <div className="mt-6" role="region" aria-label={`Bước ${currentStep + 1}: ${steps[currentStep].label}`}>
        {children({ currentStep, goToStep, data, setField })}
      </div>

      {/* Step Error */}
      {currentStepError && (
        <div role="alert" className="mt-4 p-3 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger)]">
          <p className="text-sm text-[var(--danger)] flex items-center gap-1">
            <span className="text-currentColor" aria-hidden="true">⚠</span>
            {currentStepError}
          </p>
        </div>
      )}

      {/* Navigation */}
      <StepperActions
        currentStep={currentStep}
        totalSteps={steps.length}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onComplete={isLastStep ? handleComplete : undefined}
        completeLabel={completeLabel}
        loading={loading}
        nextDisabled={currentStepError !== undefined}
      />

      {/* Cancel button */}
      {onCancel && (
        <div className="mt-4 text-center">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
            Hủy bỏ
          </Button>
        </div>
      )}
    </div>
  );
}

/** Hook để dùng FormWizard logic mà không cần UI components */
export function useFormWizard(steps: WizardStep[], initialData: Record<string, unknown> = {}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const setField = useCallback((key: string, value: unknown) => {
    setData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }, [errors]);

  const setFields = useCallback((fields: Record<string, unknown>) => {
    setData((prev) => ({ ...prev, ...fields }));
  }, []);

  const validateStep = useCallback(
    (stepIndex: number): boolean => {
      const step = steps[stepIndex];
      if (!step.validate) return true;

      const error = step.validate(data);
      if (error) {
        setErrors((prev) => ({ ...prev, [step.key]: error }));
        return false;
      }
      setErrors((prev) => {
        const next = { ...prev };
        delete next[step.key];
        return next;
      });
      return true;
    },
    [data, steps]
  );

  const goToStep = useCallback(
    (index: number) => {
      if (index < 0 || index >= steps.length) return;
      if (steps[index].disabled) return;
      setCurrentStep(index);
    },
    [steps]
  );

  const next = useCallback(() => {
    if (validateStep(currentStep)) {
      if (currentStep < steps.length - 1) {
        goToStep(currentStep + 1);
      }
    }
  }, [currentStep, goToStep, steps, validateStep]);

  const previous = useCallback(() => {
    if (currentStep > 0) goToStep(currentStep - 1);
  }, [currentStep, goToStep]);

  const reset = useCallback(() => {
    setCurrentStep(0);
    setData(initialData);
    setErrors({});
  }, [initialData]);

  return {
    currentStep,
    data,
    errors,
    loading,
    setLoading,
    setField,
    setFields,
    goToStep,
    next,
    previous,
    reset,
    validateStep,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === steps.length - 1,
    stepKeys: steps.map((s) => s.key),
  };
}