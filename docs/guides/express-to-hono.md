# Express to Hono

The recipe converts only supported route and middleware shapes. Preserve route order, status codes, response bodies, error propagation, and authorization boundaries. Express request augmentation such as `req.user` must become an explicitly typed Hono context variable.

Capture route/middleware behavior before transformation. Unsupported dynamic registration, ambiguous middleware, streaming, or custom response mutation must remain unchanged with a warning. Validate route parity, authentication, errors, headers, and deployment runtime before approval.
