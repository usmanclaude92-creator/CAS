package com.example.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import androidx.sqlite.db.SupportSQLiteDatabase
import com.example.data.model.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class Converters {
    @TypeConverter
    fun fromTransactionType(value: TransactionType): String = value.name

    @TypeConverter
    fun toTransactionType(value: String): TransactionType = runCatching {
        TransactionType.valueOf(value)
    }.getOrDefault(TransactionType.DIRECT_EXPENSE)

    @TypeConverter
    fun fromTransactionStatus(value: TransactionStatus): String = value.name

    @TypeConverter
    fun toTransactionStatus(value: String): TransactionStatus = runCatching {
        TransactionStatus.valueOf(value)
    }.getOrDefault(TransactionStatus.SUBMITTED)

    @TypeConverter
    fun fromAccountType(value: AccountType): String = value.name

    @TypeConverter
    fun toAccountType(value: String): AccountType = runCatching {
        AccountType.valueOf(value)
    }.getOrDefault(AccountType.BANK)
}

@Database(
    entities = [
        ProjectEntity::class,
        CustomerEntity::class,
        VendorEntity::class,
        AccountEntity::class,
        ExpenseHeadEntity::class,
        TransactionEntity::class,
        AuditLogEntity::class
    ],
    version = 1,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class CasDatabase : RoomDatabase() {

    abstract fun casDao(): CasDao

    companion object {
        @Volatile
        private var INSTANCE: CasDatabase? = null

        fun getDatabase(context: Context, scope: CoroutineScope): CasDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    CasDatabase::class.java,
                    "cas_construction_accounting.db"
                )
                    .fallbackToDestructiveMigration()
                    .addCallback(DatabaseCallback(scope))
                    .build()
                INSTANCE = instance
                instance
            }
        }

        private class DatabaseCallback(
            private val scope: CoroutineScope
        ) : RoomDatabase.Callback() {
            override fun onCreate(db: SupportSQLiteDatabase) {
                super.onCreate(db)
                INSTANCE?.let { database ->
                    scope.launch(Dispatchers.IO) {
                        seedDatabase(database.casDao())
                    }
                }
            }
        }

        internal suspend fun seedDatabase(dao: CasDao) {
            // Seed Customers
            val cust1 = CustomerEntity(
                id = "cust-001",
                code = "CUST-001",
                name = "Al Harthy Properties LLC",
                contactPerson = "Eng. Salim Al Harthy",
                phone = "+968 9123 4567",
                email = "salim@alharthyproperties.om",
                address = "Al Khoudh, Seeb, Muscat",
                openingBalance = 0.0,
                createdAt = "2026-01-01"
            )
            val cust2 = CustomerEntity(
                id = "cust-002",
                code = "CUST-002",
                name = "Oman Golden Sands Dev",
                contactPerson = "Tariq Al Balushi",
                phone = "+968 9988 7766",
                email = "tariq@goldensands.om",
                address = "Bausher, Muscat",
                openingBalance = 0.0,
                createdAt = "2026-01-01"
            )
            dao.insertCustomer(cust1)
            dao.insertCustomer(cust2)

            // Seed Vendors
            val vend1 = VendorEntity(
                id = "vend-001",
                code = "VEND-001",
                name = "Al Batinah Building Materials LLC",
                category = "Rebar, Steel & Cement",
                contactPerson = "Nasser Al Farsi",
                phone = "+968 9456 1234",
                email = "sales@batinahmaterials.om",
                address = "Barka Industrial Area",
                openingBalance = 0.0,
                createdAt = "2026-01-01"
            )
            val vend2 = VendorEntity(
                id = "vend-002",
                code = "VEND-002",
                name = "Muscat ReadyMix Concrete SAOC",
                category = "Structural Concrete",
                contactPerson = "Rajesh Kumar",
                phone = "+968 9234 5678",
                email = "orders@muscatreadymix.om",
                address = "Rusayl Industrial Estate",
                openingBalance = 0.0,
                createdAt = "2026-01-01"
            )
            dao.insertVendor(vend1)
            dao.insertVendor(vend2)

            // Seed Projects
            val prj1 = ProjectEntity(
                id = "prj-akv-001",
                code = "PRJ-AKV-001",
                name = "Al Khoudh Villa Project",
                customerId = "cust-001",
                customerName = "Al Harthy Properties LLC",
                contractValue = 85000.0,
                budgetCost = 65000.0,
                startDate = "2026-01-15",
                status = "active",
                remarks = "G+2 Luxury Villa Construction in Al Khoudh 6",
                createdAt = "2026-01-15"
            )
            val prj2 = ProjectEntity(
                id = "prj-bsh-002",
                code = "PRJ-BSH-002",
                name = "Bausher Commercial Plaza",
                customerId = "cust-002",
                customerName = "Oman Golden Sands Dev",
                contractValue = 120000.0,
                budgetCost = 90000.0,
                startDate = "2026-02-01",
                status = "active",
                remarks = "Commercial complex with 12 retail units",
                createdAt = "2026-02-01"
            )
            dao.insertProject(prj1)
            dao.insertProject(prj2)

            // Seed Treasury Accounts
            val acc1 = AccountEntity(
                id = "bank-muscat-001",
                accountType = AccountType.BANK,
                bankName = "Bank Muscat",
                accountName = "Bank Muscat — Main Operating",
                accountNumber = "0315-01234567-001",
                iban = "OM82BMUS000000031501234567001",
                currency = "OMR",
                openingBalance = 25000.0,
                currentBalance = 37500.0,
                createdAt = "2026-01-01"
            )
            val acc2 = AccountEntity(
                id = "bank-nbo-002",
                accountType = AccountType.BANK,
                bankName = "National Bank of Oman",
                accountName = "NBO — SMI Escrow Account",
                accountNumber = "1004-98765432-002",
                iban = "OM82NBOA000000100498765432002",
                currency = "OMR",
                openingBalance = 10000.0,
                currentBalance = 10000.0,
                createdAt = "2026-01-01"
            )
            val acc3 = AccountEntity(
                id = "cash-main-001",
                accountType = AccountType.CASH,
                bankName = "Head Office Cash Safe",
                accountName = "HO Petty Cash Safe",
                accountNumber = "SAFE-01",
                currency = "OMR",
                openingBalance = 1500.0,
                currentBalance = 1120.0,
                createdAt = "2026-01-01"
            )
            dao.insertAccount(acc1)
            dao.insertAccount(acc2)
            dao.insertAccount(acc3)

            // Seed Expense Heads
            dao.insertExpenseHead(ExpenseHeadEntity("exp-001", "Steel Rebar & Binding Wire", "Materials"))
            dao.insertExpenseHead(ExpenseHeadEntity("exp-002", "Ready-Mix Concrete Grade C35", "Materials"))
            dao.insertExpenseHead(ExpenseHeadEntity("exp-003", "Daily Mason & Labor Wages", "Site Operations"))
            dao.insertExpenseHead(ExpenseHeadEntity("exp-004", "Excavator & Crane Rental", "Equipment"))
            dao.insertExpenseHead(ExpenseHeadEntity("exp-005", "Diesel & Generator Fuel", "Site Utilities"))
            dao.insertExpenseHead(ExpenseHeadEntity("exp-006", "Scaffolding & Shuttering", "Temporary Works"))

            // Seed Sample Transactions
            val tx1 = TransactionEntity(
                id = "tx-inv-001",
                type = TransactionType.CLIENT_INVOICE,
                date = "2026-01-20",
                documentRef = "IPC-AKV-001",
                projectId = "prj-akv-001",
                projectName = "Al Khoudh Villa Project",
                customerId = "cust-001",
                customerName = "Al Harthy Properties LLC",
                description = "IPC #1: Foundation & Substructure mobilization",
                amount = 25000.0,
                receivedOrPaidAmount = 20000.0,
                outstandingAmount = 5000.0,
                status = TransactionStatus.POSTED,
                createdBy = "Chief Accountant",
                approvedBy = "CFO / Admin",
                createdAt = "2026-01-20"
            )

            val tx2 = TransactionEntity(
                id = "tx-in-001",
                type = TransactionType.MONEY_IN,
                date = "2026-01-25",
                documentRef = "RCT-2026-001",
                projectId = "prj-akv-001",
                projectName = "Al Khoudh Villa Project",
                customerId = "cust-001",
                customerName = "Al Harthy Properties LLC",
                accountId = "bank-muscat-001",
                accountName = "Bank Muscat — Main Operating",
                description = "Direct Bank Wire against IPC-AKV-001",
                amount = 20000.0,
                receivedOrPaidAmount = 20000.0,
                outstandingAmount = 0.0,
                status = TransactionStatus.POSTED,
                createdBy = "Chief Accountant",
                approvedBy = "CFO / Admin",
                createdAt = "2026-01-25"
            )

            val tx3 = TransactionEntity(
                id = "tx-pur-001",
                type = TransactionType.PURCHASE,
                date = "2026-01-28",
                documentRef = "PO-BAT-4001",
                projectId = "prj-akv-001",
                projectName = "Al Khoudh Villa Project",
                vendorId = "vend-001",
                vendorName = "Al Batinah Building Materials LLC",
                description = "Supply of 12mm & 16mm High Tensile Deformed Rebar",
                amount = 8200.0,
                receivedOrPaidAmount = 5000.0,
                outstandingAmount = 3200.0,
                status = TransactionStatus.POSTED,
                createdBy = "Project Manager",
                approvedBy = "Chief Accountant",
                createdAt = "2026-01-28"
            )

            val tx4 = TransactionEntity(
                id = "tx-out-001",
                type = TransactionType.MONEY_OUT,
                date = "2026-02-02",
                documentRef = "PMT-BAT-001",
                projectId = "prj-akv-001",
                projectName = "Al Khoudh Villa Project",
                vendorId = "vend-001",
                vendorName = "Al Batinah Building Materials LLC",
                accountId = "bank-muscat-001",
                accountName = "Bank Muscat — Main Operating",
                description = "Cheque Payment for partial steel delivery",
                amount = 5000.0,
                receivedOrPaidAmount = 5000.0,
                outstandingAmount = 0.0,
                status = TransactionStatus.POSTED,
                createdBy = "Chief Accountant",
                approvedBy = "CFO / Admin",
                createdAt = "2026-02-02"
            )

            val tx5 = TransactionEntity(
                id = "tx-exp-001",
                type = TransactionType.DIRECT_EXPENSE,
                date = "2026-02-05",
                documentRef = "EXP-PET-101",
                projectId = "prj-akv-001",
                projectName = "Al Khoudh Villa Project",
                accountId = "cash-main-001",
                accountName = "HO Petty Cash Safe",
                expenseHeadId = "exp-005",
                expenseHeadName = "Diesel & Generator Fuel",
                description = "Diesel 450 Liters for on-site batching generator",
                amount = 380.0,
                receivedOrPaidAmount = 380.0,
                outstandingAmount = 0.0,
                status = TransactionStatus.POSTED,
                createdBy = "Site Engineer",
                approvedBy = "Project Manager",
                createdAt = "2026-02-05"
            )

            // Pending approval items for workflow verification
            val txPending1 = TransactionEntity(
                id = "tx-pen-001",
                type = TransactionType.PURCHASE,
                date = "2026-02-10",
                documentRef = "PO-RMY-8821",
                projectId = "prj-bsh-002",
                projectName = "Bausher Commercial Plaza",
                vendorId = "vend-002",
                vendorName = "Muscat ReadyMix Concrete SAOC",
                description = "85 cubic meters C35 Structural Concrete for Retaining Wall",
                amount = 4250.0,
                receivedOrPaidAmount = 0.0,
                outstandingAmount = 4250.0,
                status = TransactionStatus.SUBMITTED,
                createdBy = "Project Manager",
                createdAt = "2026-02-10"
            )

            val txPending2 = TransactionEntity(
                id = "tx-pen-002",
                type = TransactionType.DIRECT_EXPENSE,
                date = "2026-02-12",
                documentRef = "EXP-LAB-042",
                projectId = "prj-bsh-002",
                projectName = "Bausher Commercial Plaza",
                accountId = "cash-main-001",
                accountName = "HO Petty Cash Safe",
                expenseHeadId = "exp-003",
                expenseHeadName = "Daily Mason & Labor Wages",
                description = "Overtime wages for night concrete pour inspection",
                amount = 260.0,
                receivedOrPaidAmount = 260.0,
                outstandingAmount = 0.0,
                status = TransactionStatus.SUBMITTED,
                createdBy = "Site Engineer",
                createdAt = "2026-02-12"
            )

            dao.insertTransaction(tx1)
            dao.insertTransaction(tx2)
            dao.insertTransaction(tx3)
            dao.insertTransaction(tx4)
            dao.insertTransaction(tx5)
            dao.insertTransaction(txPending1)
            dao.insertTransaction(txPending2)

            // Seed Audit Log
            dao.insertAuditLog(
                AuditLogEntity(
                    id = "aud-001",
                    timestamp = "2026-01-15 08:00:00",
                    userName = "CFO / Admin",
                    userRole = "ADMIN",
                    action = "INITIALIZE_SYSTEM",
                    module = "Configuration",
                    details = "Construction Accounting Database initialized with acceptance test standards."
                )
            )
        }
    }
}
