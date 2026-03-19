import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true });

export const validateBody = (schema) => {
  const validate = ajv.compile(schema);
  
  return (req, res, next) => {
    const isValid = validate(req.body);
    if (!isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validate.errors
      });
    }
    next();
  };
};

export const authAndValidate = (schema, authMiddleware) => {
  // Common middleware combiner as requested over array
  return [authMiddleware, validateBody(schema)];
};
