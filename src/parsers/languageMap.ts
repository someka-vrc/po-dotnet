/**
 * Mapping of language IDs to their corresponding WebAssembly parser names and query strings.
 * Each entry contains:
 * - wasmName: The name of the WebAssembly file for the Tree-sitter parser.
 * - query: The Tree-sitter query string to identify function calls and their arguments.
 */
export const LanguageWasmMap: { [languageId: string]: { wasmName: string; query: string } } = {
  csharp: {
    wasmName: "tree-sitter-c_sharp.wasm",
    // Intention: capture C# invocation expressions.
    // - Plain function calls where the callee is an identifier, e.g. G("...")
    // - Member access calls where the method name is captured, e.g. localizer.GetString("...")
    // Captures: @func-name (identifier/name) and @args (argument_list)
    query: `
      (invocation_expression
        function: (identifier) @func-name
        arguments: (argument_list) @args)

      (invocation_expression
        function: (member_access_expression
          name: (identifier) @func-name)
        arguments: (argument_list) @args)
    `,
  },
  javascript: {
    wasmName: "tree-sitter-javascript.wasm",
    // Intention: capture JavaScript call forms. Each bullet corresponds to a query block below.
    // - Plain call: function is an identifier, e.g. `G("...")` (captures identifier @func-name)
    // - Member call (property identifier): `obj.method(...)` (captures property identifier @func-name)
    // - Member call (identifier property form): cases where member property is returned as an identifier node (captures identifier @func-name)
    // - Optional chaining (property identifier): `obj?.method(...)` (captures property identifier @func-name)
    // - Optional chaining (identifier property form): `obj?.method(...)` variants where property is an identifier node (captures identifier @func-name)
    // Captures: @func-name and @args (arguments)
    query: `
      (call_expression
        function: (identifier) @func-name
        arguments: (arguments) @args)

      (call_expression
        function: (member_expression
          property: (property_identifier) @func-name)
        arguments: (arguments) @args)

      (call_expression
        function: (member_expression
          property: (identifier) @func-name)
        arguments: (arguments) @args)

      (optional_call_expression
        function: (optional_member_expression
          property: (property_identifier) @func-name)
        arguments: (arguments) @args)

      (optional_call_expression
        function: (optional_member_expression
          property: (identifier) @func-name)
        arguments: (arguments) @args)
    `,
  },
  typescript: {
    wasmName: "tree-sitter-typescript.wasm",
    // Intention: capture TypeScript call forms. Each bullet corresponds to a query block below.
    // - Plain call: function is an identifier, e.g. `G("...")` (captures identifier @func-name)
    // - Member call (property identifier): `obj.method(...)` (captures property identifier @func-name)
    // - Member call (identifier property form): member property represented as identifier node (captures identifier @func-name)
    // - Optional chaining (property identifier): `obj?.method(...)` (captures property identifier @func-name)
    // - Optional chaining (identifier property form): optional member property as identifier node (captures identifier @func-name)
    // Captures: @func-name and @args (arguments)
    query: `
      (call_expression
        function: (identifier) @func-name
        arguments: (arguments) @args)

      (call_expression
        function: (member_expression
          property: (property_identifier) @func-name)
        arguments: (arguments) @args)

      (call_expression
        function: (member_expression
          property: (identifier) @func-name)
        arguments: (arguments) @args)

      (optional_call_expression
        function: (optional_member_expression
          property: (property_identifier) @func-name)
        arguments: (arguments) @args)

      (optional_call_expression
        function: (optional_member_expression
          property: (identifier) @func-name)
        arguments: (arguments) @args)
    `,
  },
  python: {
    wasmName: "tree-sitter-python.wasm",
    // Intention: capture Python calls and attribute access forms. Each bullet maps to the query blocks below.
    // - Plain call: function is an identifier, e.g. `G("...")` (captures identifier @func-name)
    // - Attribute call: `obj.method(...)` where function is an attribute with an identifier child (captures identifier @func-name)
    // - Nested attribute: `obj.attr.method(...)` where function is attribute whose attribute child is an identifier (captures identifier @func-name)
    // Captures: @func-name (identifier/attribute name) and @args (argument_list)
    query: `
      (call
        function: (identifier) @func-name
        arguments: (argument_list) @args)

      (call
        function: (attribute
          (identifier) @func-name)
        arguments: (argument_list) @args)

      (call
        function: (attribute
          attribute: (identifier) @func-name)
        arguments: (argument_list) @args)
    `,
  },
};
