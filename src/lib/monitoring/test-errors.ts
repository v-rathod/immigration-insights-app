/**
 * Test error generator — for dashboard testing only.
 * 
 * Usage in browser console (dev or stage):
 *   window.generateTestErrors(5)  // generates 5 random errors
 *   window.generateSpecificError('TypeError')
 * 
 * Or import in a test page and call programmatically.
 * 
 * Each call generates a different error type to populate the dashboard
 * with variety in error_type, severity, page, etc.
 */

export function generateTestErrors(count: number = 5): void {
  const errorGenerators = [
    () => generateTypeError(),
    () => generateReferenceError(),
    () => generateUnhandledRejection(),
    () => generateCustomError(),
    () => generateNetworkError(),
  ];

  for (let i = 0; i < count; i++) {
    const generator = errorGenerators[i % errorGenerators.length];

    setTimeout(() => {
      try {
        generator();
      } catch (err) {
        console.log(`Generated test error #${i + 1}`);
      }
    }, i * 200); // Stagger errors by 200ms so they appear as separate events
  }

  console.log(
    `✅ Generated ${count} test errors. Check PostHog Events → error_occurred in ~${count * 0.2}s`
  );
}

function generateTypeError(): void {
  const obj: Record<string, unknown> = {};
  // @ts-ignore — intentional error
  obj.nested.property.value = "test";
}

function generateReferenceError(): void {
  // @ts-ignore — intentional reference to undefined variable
  nonExistentVariable.doSomething();
}

function generateUnhandledRejection(): void {
  Promise.reject(new Error("Test unhandled promise rejection"));
}

function generateCustomError(): void {
  throw new Error("Custom test error: database connection failed");
}

function generateNetworkError(): void {
  // Attempt to fetch from invalid URL
  fetch("https://invalid-test-domain-12345.example.com/api/data").catch(
    (err) => {
      throw err;
    }
  );
}

/**
 * Generate a single error of a specific type.
 * Useful for targeted testing.
 */
export function generateSpecificError(
  type:
    | "TypeError"
    | "ReferenceError"
    | "UnhandledRejection"
    | "Custom"
    | "Network"
): void {
  const generators: Record<
    string,
    () => void
  > = {
    TypeError: generateTypeError,
    ReferenceError: generateReferenceError,
    UnhandledRejection: generateUnhandledRejection,
    Custom: generateCustomError,
    Network: generateNetworkError,
  };

  const generator = generators[type];
  if (generator) {
    try {
      generator();
    } catch (err) {
      console.log(`Generated ${type} error`);
    }
  } else {
    console.error(`Unknown error type: ${type}`);
  }
}
