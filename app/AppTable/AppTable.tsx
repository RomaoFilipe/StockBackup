"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FiltersAndActions from "../FiltersAndActions";
import { PaginationType } from "../Products/PaginationSelection";
import { ProductTable } from "../Products/ProductTable";
import { columns } from "../Products/columns";
import { useAuth } from "../authContext";
import { useProductStore } from "../useProductStore";
//import { ColumnFiltersState } from "@tanstack/react-table";

const AppTable = React.memo(() => {
  const { allProducts, loadProducts, isLoading } = useProductStore();
  const { isLoggedIn, isAuthLoading, user } = useAuth();
  const router = useRouter();

  // State for column filters, search term, and pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [pagination, setPagination] = useState<PaginationType>({
    pageIndex: 0,
    pageSize: 8,
  });

  // State for selected filters
  const [selectedCategory, setSelectedCategory] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const previousMaxPriceRef = useRef<number>(1000);

  const maxPriceInData = useMemo(() => {
    const maxPrice = allProducts.reduce((acc, p) => Math.max(acc, Number(p.price) || 0), 0);
    return Math.max(100, Math.ceil(maxPrice));
  }, [allProducts]);

  useEffect(() => {
    setPagination((prev) =>
      prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }
    );
  }, [searchTerm, selectedCategory, selectedStatuses, selectedSuppliers, priceRange]);

  useEffect(() => {
    setPriceRange((prev) => {
      const wasUsingFullRange = prev[0] === 0 && prev[1] === previousMaxPriceRef.current;
      if (wasUsingFullRange) {
        previousMaxPriceRef.current = maxPriceInData;
        return [0, maxPriceInData];
      }
      const nextMin = Math.min(prev[0], maxPriceInData);
      const nextMax = Math.min(Math.max(prev[1], nextMin), maxPriceInData);
      previousMaxPriceRef.current = maxPriceInData;
      if (nextMin === prev[0] && nextMax === prev[1]) return prev;
      return [nextMin, nextMax];
    });
  }, [maxPriceInData]);

  // Memoize the loadProducts callback to prevent unnecessary re-renders
  const handleLoadProducts = useCallback(() => {
    if (isLoggedIn) {
      loadProducts();
    }
  }, [isLoggedIn, loadProducts]);

  // Load products if the user is logged in
  useEffect(() => {
    if (isAuthLoading) return;

    if (!isLoggedIn) {
      router.replace("/login");
    } else {
      handleLoadProducts();
    }
  }, [isAuthLoading, isLoggedIn, handleLoadProducts, router]);

  useEffect(() => {
    // Debug log for products - only log in development
    if (process.env.NODE_ENV === 'development') {
      console.log("All Products in AppTable:", allProducts);
    }
  }, [allProducts]);

  if (isAuthLoading || !isLoggedIn || !user) {
    return null;
  }

  return (
    <div className="flex flex-col gap-5 poppins">
      <div className="glass-panel rounded-2xl p-4 sm:p-5 lg:p-6">
        {/* Filters and Actions */}
        <FiltersAndActions
          userId={user.id}
          userName={user.name || "Utilizador"}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          viewMode={viewMode}
          setViewMode={setViewMode}
          priceRange={priceRange}
          setPriceRange={setPriceRange}
          maxPrice={maxPriceInData}
          pagination={pagination}
          setPagination={setPagination}
          allProducts={allProducts}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          selectedStatuses={selectedStatuses}
          setSelectedStatuses={setSelectedStatuses}
          selectedSuppliers={selectedSuppliers}
          setSelectedSuppliers={setSelectedSuppliers}
        />

        {/* Product Table */}
        <ProductTable
          data={allProducts || []}
          columns={columns}
          userId={user.id}
          isLoading={isLoading}
          searchTerm={searchTerm}
          pagination={pagination}
          setPagination={setPagination}
          viewMode={viewMode}
          priceRange={priceRange}
          selectedCategory={selectedCategory}
          selectedStatuses={selectedStatuses}
          selectedSuppliers={selectedSuppliers}
        />
      </div>
    </div>
  );
});

AppTable.displayName = 'AppTable';

export default AppTable;
