import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">404</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-4">Halaman tidak ditemukan</p>
        <Link to="/" className="text-blue-500 hover:text-blue-700 underline">
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
