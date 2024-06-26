module.exports = function createValidator(schema) {
    return function (instance) {
        var error = [];

        Object.keys(schema).forEach(function (schemaKey) {
            var criteria = schema[schemaKey];
            var value = instance[schemaKey];

            if (criteria.required && typeof value === 'undefined') {
                return error.push('Required ' + schemaKey + ' is not present.');
            }

            var type = Array.isArray(value) ? 'array' : typeof value;
            if (criteria.type && type !== criteria.type) {
                return error.push(
                    'Requires `' +
                        schemaKey +
                        '` to be of type [' +
                        criteria.type +
                        '] but is [' +
                        type +
                        ']'
                );
            }

            if (Array.isArray(value)) {
                if (criteria.minLen && criteria.minLen > value.length) {
                    error.push(
                        'Expected `' +
                            schemaKey +
                            '` to be at least ' +
                            criteria.minLen +
                            ' long'
                    );
                }
                if (criteria.maxLen && criteria.maxLen < value.length) {
                    error.push(
                        'Expected `' +
                            schemaKey +
                            '` to be below ' +
                            criteria.maxLen +
                            ' long'
                    );
                }
            }
        });

        if (instance.options && Array.isArray(schema.supportedOptionFields)) {
            const unsupportedOptionFields = Object.keys(
                instance.options
            ).filter((field) => {
                return schema.supportedOptionFields.indexOf(field) === -1;
            });

            if (unsupportedOptionFields.length > 0) {
                error.push(
                    'Found unsupported options `' +
                        unsupportedOptionFields.join('`, `') +
                        '`'
                );
            }
        }

        if (error.length) {
            throw new Error(
                error.filter(Boolean).reduce(function (reduced, error) {
                    return (reduced += 'x ' + error + '\n');
                }, '[Bad configuration] Configuration is not valid:\n') +
                    JSON.stringify(instance, null, 2)
            );
        }
    };
};
