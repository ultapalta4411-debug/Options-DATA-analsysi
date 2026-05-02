export function errorMiddleware(err, req, res, next) {
	console.error('API error caught:', err);
	res.status(err.status || 500).json({
		error: err.message || 'Internal Server Error',
	});
}
